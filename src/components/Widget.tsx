/**
 * Main Widget component - Entry point for the embeddable widget
 */

import React, { useEffect } from 'react';
import { initializeTheme } from '../stores/widgetStore';
import { useWidgetState, useStore } from '../contexts/StoreContext';
import type { WidgetConfig, Location } from '../types';
import { MapView } from './MapView';
import { TableView } from './TableView';
import { Filters } from './Filters';

interface WidgetProps {
  config: WidgetConfig;
  dataPromise: Promise<Location[]>;
}

export const Widget: React.FC<WidgetProps> = ({ config, dataPromise }) => {
  const store = useStore();
  const { setLocations, setLoading, setError, setTheme } = useWidgetState(
    (state) => ({
      setLocations: state.setLocations,
      setLoading: state.setLoading,
      setError: state.setError,
      setTheme: state.setTheme,
    })
  );

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme(store);
    if (config.theme) {
      setTheme(config.theme);
    }
  }, [config.theme, setTheme, store]);

  // Consume the pre-started data promise
  useEffect(() => {
    setLoading(true);
    setError(null);

    dataPromise
      .then((locations) => {
        if (locations.length === 0) {
          setError('No locations found in data source');
        } else {
          setLocations(locations);
          const state = store.getState();
          state.setCategoriesFromLocations(locations, config.categoryConfig);
        }
      })
      .catch((err) => {
        console.error('Error fetching locations:', err);
        const message = err instanceof Error ? err.message : 'Failed to load locations';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dataPromise, config.categoryConfig, setLocations, setLoading, setError, store]);

  // Set initial config values
  useEffect(() => {
    const state = store.getState();

    if (config.defaultView) {
      state.setCurrentView(config.defaultView);
    }

    if (config.defaultCenter) {
      state.setMapCenter(config.defaultCenter);
    }

    if (config.defaultZoom) {
      state.setMapZoom(config.defaultZoom);
    }

    if (config.itemsPerPage) {
      store.setState({ itemsPerPage: config.itemsPerPage });
    }
  }, [config, store]);

  return (
    <div
      className="widget-container lmw-w-full lmw-h-full lmw-bg-white dark:lmw-bg-gray-900 lmw-text-gray-900 dark:lmw-text-gray-100 lmw-font-sans lmw-antialiased"
      style={config.height ? { height: config.height } : undefined}
    >
      <WidgetContent config={config} />
    </div>
  );
};

/**
 * Widget content — renders map immediately so tiles load in parallel with data fetch.
 * Shows a loading overlay on top of the map while data is loading.
 */
const WidgetContent: React.FC<{ config: WidgetConfig }> = ({ config }) => {
  const { loading, error, currentView } = useWidgetState((state) => ({
    loading: state.loading,
    error: state.error,
    currentView: state.currentView,
  }));

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="lmw-w-full lmw-h-full lmw-flex lmw-flex-col">

      {/* Filters Section — hidden while loading */}
      {!loading && <Filters />}

      {/* Main Content Area */}
      <div
        className="lmw-flex-1 lmw-overflow-hidden lmw-bg-white dark:lmw-bg-gray-900 lmw-relative"
        style={{ minHeight: '400px' }}
        role="tabpanel"
        id={`${currentView}-panel`}
        aria-labelledby={`${currentView}-tab`}
      >
        {currentView === 'map' || loading ? (
          <>
            <MapView
              enableClustering={config.enableClustering}
              showFullscreenButton={config.showFullscreenButton}
            />
            {loading && <MapLoadingOverlay />}
          </>
        ) : (
          <TableView />
        )}
      </div>
    </div>
  );
};

/**
 * Lightweight loading overlay shown on top of the map while data fetches
 */
const MapLoadingOverlay: React.FC = () => {
  return (
    <div className="lmw-absolute lmw-inset-0 lmw-z-[1000] lmw-flex lmw-items-center lmw-justify-center lmw-pointer-events-none">
      <div className="lmw-bg-white/90 dark:lmw-bg-gray-800/90 lmw-rounded-lg lmw-px-5 lmw-py-3 lmw-shadow-lg lmw-flex lmw-items-center lmw-gap-3">
        <svg className="lmw-animate-spin lmw-h-5 lmw-w-5 lmw-text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="lmw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="lmw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="lmw-text-sm lmw-text-gray-700 dark:lmw-text-gray-300">Loading locations...</span>
      </div>
    </div>
  );
};

/**
 * Error state component
 */
const ErrorState: React.FC<{ message: string }> = ({ message }) => {
  const setError = useWidgetState((state) => state.setError);

  const handleRetry = () => {
    // Trigger a re-fetch by clearing error
    setError(null);
    // The useEffect in Widget will automatically re-fetch
  };

  return (
    <div className="lmw-w-full lmw-h-full lmw-flex lmw-items-center lmw-justify-center lmw-bg-white dark:lmw-bg-gray-900">
      <div className="lmw-text-center lmw-max-w-md lmw-p-6">
        {/* Error Icon */}
        <div className="lmw-mx-auto lmw-w-16 lmw-h-16 lmw-mb-4 lmw-text-red-500">
          <svg
            className="lmw-w-full lmw-h-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="lmw-text-lg lmw-font-semibold lmw-text-gray-900 dark:lmw-text-gray-100 lmw-mb-2">
          Failed to Load Locations
        </h3>

        <p className="lmw-text-gray-600 dark:lmw-text-gray-400 lmw-mb-4">
          {message}
        </p>

        <button
          onClick={handleRetry}
          className="lmw-px-4 lmw-py-2 lmw-bg-primary lmw-text-white lmw-rounded-md hover:lmw-bg-blue-600 active:lmw-bg-blue-700 lmw-cursor-pointer lmw-transition-all lmw-duration-200 focus-visible:lmw-outline-none focus-visible:lmw-ring-2 focus-visible:lmw-ring-primary focus-visible:lmw-ring-offset-2"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
