/**
 * LocationMarker component - Individual marker with popup
 */

import React, { useRef, useEffect, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Location } from "../../types";
import { useWidgetState, useStore } from "../../contexts/StoreContext";
import { ImageGallery, CustomFields } from "../shared";
import { ExpandableText } from "../common/ExpandableText";

interface LocationMarkerProps {
  location: Location;
}

// Icon cache: keyed by color string to avoid repeated SVG→base64 encoding
const iconCache = new Map<string, L.Icon>();

const getMarkerIcon = (category: string, store: any): L.Icon => {
  const { categories } = store.getState();
  const categoryMeta = categories.find(
    (c: any) => c.name.toLowerCase() === category.toLowerCase()
  );

  const color = categoryMeta?.style.color || "#6B7280";

  // Return cached icon if we already built one for this color
  const cached = iconCache.get(color);
  if (cached) return cached;

  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" stroke="#ffffff" stroke-width="2"
        d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
      <circle cx="12.5" cy="12.5" r="5" fill="#ffffff"/>
    </svg>
  `;

  const icon = L.icon({
    iconUrl: "data:image/svg+xml;base64," + btoa(svgIcon),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  iconCache.set(color, icon);
  return icon;
};

export const LocationMarker: React.FC<LocationMarkerProps> = ({ location }) => {
  const { setSelectedLocation, selectedLocationId, isProgrammaticMove } =
    useWidgetState((state) => ({
      setSelectedLocation: state.setSelectedLocation,
      selectedLocationId: state.selectedLocationId,
      isProgrammaticMove: state.isProgrammaticMove,
    }));
  const store = useStore();
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();
  const [maxPopupHeight, setMaxPopupHeight] = useState(400);

  const handleMarkerClick = () => {
    // Pass 'marker-click' context - don't trigger map pan/zoom
    setSelectedLocation(location.id, "marker-click");

    // Directly open popup to handle both new selections and re-clicks of already-selected markers
    // Small delay to ensure state updates and any cluster spiderfy completes
    setTimeout(() => {
      openPopupWithPreCalculatedPosition();
    }, 50);
  };

  // Calculate max popup height as 70% on desktop, 80% on mobile
  useEffect(() => {
    const calculateMaxHeight = () => {
      const mapContainer = map.getContainer();
      const mapHeight = mapContainer.clientHeight;
      const mapWidth = mapContainer.clientWidth;
      const isMobile = mapWidth < 768;

      const heightPercentage = isMobile ? 0.8 : 0.7;
      const calculatedHeight = Math.max(
        300,
        Math.min(600, Math.floor(mapHeight * heightPercentage))
      );
      setMaxPopupHeight(calculatedHeight);
    };

    calculateMaxHeight();

    window.addEventListener("resize", calculateMaxHeight);
    return () => window.removeEventListener("resize", calculateMaxHeight);
  }, [map]);

  /**
   * Pre-calculate optimal map position and open popup
   * Prevents the marker from shifting out of view on mobile when the popup opens
   */
  const openPopupWithPreCalculatedPosition = () => {
    if (!markerRef.current) return;

    const mapContainer = map.getContainer();
    const mapWidth = mapContainer.clientWidth;
    const mapHeight = mapContainer.clientHeight;
    const markerLatLng = L.latLng(location.latitude, location.longitude);

    const isMobile = mapWidth < 768;

    const targetMarkerY = isMobile ? mapHeight * 0.95 : mapHeight * 0.9;
    const targetMarkerX = Math.floor(mapWidth * 0.5);

    const currentMarkerPoint = map.latLngToContainerPoint(markerLatLng);

    const pixelsToShiftY = targetMarkerY - currentMarkerPoint.y;
    const pixelsToShiftX = targetMarkerX - currentMarkerPoint.x;

    const needsPan =
      Math.abs(pixelsToShiftY) > 20 || Math.abs(pixelsToShiftX) > 20;

    if (needsPan) {
      const centerPoint = map.latLngToContainerPoint(map.getCenter());
      const newCenterPoint = L.point(
        centerPoint.x - pixelsToShiftX,
        centerPoint.y - pixelsToShiftY
      );
      const newCenter = map.containerPointToLatLng(newCenterPoint);

      map.panTo(newCenter, { animate: true, duration: 0.25 });

      setTimeout(() => {
        if (markerRef.current) {
          markerRef.current.openPopup();
        }
      }, 300);
    } else {
      markerRef.current.openPopup();
    }
  };

  // Open popup when this location is selected via table click (programmatic navigation)
  useEffect(() => {
    if (
      selectedLocationId === location.id &&
      markerRef.current &&
      isProgrammaticMove
    ) {
      const timer = setTimeout(() => {
        openPopupWithPreCalculatedPosition();
        store.setState({ isProgrammaticMove: false });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [selectedLocationId, location.id, isProgrammaticMove]);

  // Close popup when this location is deselected
  useEffect(() => {
    if (selectedLocationId !== location.id && markerRef.current) {
      const popup = markerRef.current.getPopup();
      if (popup && popup.isOpen()) {
        markerRef.current.closePopup();
      }
    }
  }, [selectedLocationId, location.id]);

  return (
    <Marker
      ref={markerRef}
      position={[location.latitude, location.longitude]}
      icon={getMarkerIcon(location.category, store)}
      eventHandlers={{
        click: handleMarkerClick,
        popupclose: () => {
          setTimeout(() => {
            const currentSelectedId = store.getState().selectedLocationId;
            if (currentSelectedId === location.id) {
              store.getState().setSelectedLocation(null);
            }
          }, 0);
        },
      }}
    >
      <Popup
        className="location-popup"
        maxWidth={300}
        minWidth={250}
        autoPan={false}
        closeOnClick={false}
      >
        <div
          className="lmw-p-2 lmw-overflow-y-auto"
          style={{ maxHeight: `${maxPopupHeight}px` }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Category badge */}
          <div className="lmw-mb-2">
            <CategoryBadge category={location.category} />
          </div>

          {/* Name */}
          <h3 className="lmw-text-lg lmw-font-bold lmw-text-gray-900 dark:lmw-text-gray-100 lmw-mb-2">
            {location.name}
          </h3>

          {/* Images */}
          {location.images && location.images.length > 0 && (
            <ImageGallery
              images={location.images}
              locationName={location.name}
            />
          )}

          {/* Address */}
          <div className="lmw-mb-2 lmw-text-sm lmw-text-gray-700 dark:lmw-text-gray-300">
            {location.address.street && <div>{location.address.street}</div>}
            <div>
              {location.address.city}, {location.address.state}{" "}
              {location.address.zip}
            </div>
          </div>

          {/* Description */}
          {location.description && (
            <ExpandableText
              text={location.description}
              className="lmw-text-sm lmw-text-gray-600 dark:lmw-text-gray-400 lmw-mb-3"
            />
          )}

          {/* Hours */}
          {location.hours && (
            <div className="lmw-mb-2 lmw-text-sm">
              <span className="lmw-font-semibold lmw-text-gray-700 dark:lmw-text-gray-300">
                Hours:
              </span>{" "}
              <span className="lmw-text-gray-600 dark:lmw-text-gray-400">
                {location.hours}
              </span>
            </div>
          )}

          {/* Contact info */}
          {location.contact && (
            <div className="lmw-space-y-1 lmw-mb-3 lmw-text-sm">
              {location.contact.phone && (
                <div>
                  <a
                    href={`tel:${location.contact.phone}`}
                    className="lmw-text-blue-600 dark:lmw-text-blue-400 hover:lmw-underline"
                  >
                    📞 {location.contact.phone}
                  </a>
                </div>
              )}
              {location.contact.email && (
                <div>
                  <a
                    href={`mailto:${location.contact.email}`}
                    className="lmw-text-blue-600 dark:lmw-text-blue-400 hover:lmw-underline"
                  >
                    ✉️ {location.contact.email}
                  </a>
                </div>
              )}
              {location.contact.website && (
                <div>
                  <a
                    href={location.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lmw-text-blue-600 dark:lmw-text-blue-400 hover:lmw-underline"
                  >
                    🌐 Website
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Custom Fields */}
          {location.customFields &&
            Object.keys(location.customFields).length > 0 && (
              <div className="lmw-mb-3">
                <CustomFields customFields={location.customFields} location={location} />
              </div>
            )}

          {/* Main URL link */}
          {location.url && (
            <div className="lmw-mt-3">
              <a
                href={location.url}
                target="_blank"
                rel="noopener noreferrer"
                className="lmw-inline-block lmw-px-3 lmw-py-2 lmw-text-sm lmw-font-medium lmw-text-white lmw-bg-primary lmw-rounded-md hover:lmw-bg-blue-600 lmw-transition-colors"
              >
                View Details →
              </a>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

/**
 * Category badge component with dynamic styling
 */
const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const store = useStore();
  const { categories } = store.getState();
  const categoryMeta = categories.find(
    (c) => c.name.toLowerCase() === category.toLowerCase()
  );

  if (!categoryMeta) {
    return (
      <span className="lmw-inline-block lmw-px-2 lmw-py-1 lmw-text-xs lmw-font-semibold lmw-rounded lmw-bg-gray-100 lmw-text-gray-800 dark:lmw-bg-gray-700 dark:lmw-text-gray-200">
        {category}
      </span>
    );
  }

  const { bg, text, darkBg, darkText } = categoryMeta.style;
  const classes = `lmw-inline-block lmw-px-2 lmw-py-1 lmw-text-xs lmw-font-semibold lmw-rounded ${bg} ${text} ${darkBg} ${darkText}`;

  return <span className={classes}>{category}</span>;
};
