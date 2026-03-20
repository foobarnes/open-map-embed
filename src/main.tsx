/**
 * Main entry point for the embeddable widget
 * Exposes the OpenMapEmbed global object for embedding
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from './components/Widget';
import { createWidgetStore } from './stores/widgetStore';
import { StoreProvider } from './contexts/StoreContext';
import { createFieldRendererRegistry } from './renderers';
import { createDataAdapter } from './adapters';
import { parseURLConfig, embedOptionsToWidgetConfig } from './utils/urlConfig';
import type { WidgetInitParams, WidgetConfig, Location } from './types';
import './style.css';

/**
 * Initialize the widget
 */
function init(params: WidgetInitParams): void {
  // Get container element
  let container: HTMLElement | null;

  if (typeof params.container === 'string') {
    container = document.querySelector(params.container);
    if (!container) {
      throw new Error(`Container not found: ${params.container}`);
    }
  } else {
    container = params.container;
  }

  // Merge config with defaults
  const config: WidgetConfig = {
    dataSource: params.dataSource,
    height: params.config?.height, // Let container control height if not specified
    defaultView: params.config?.defaultView || 'map',
    theme: params.config?.theme || 'auto',
    defaultCenter: params.config?.defaultCenter || [39.8283, -98.5795],
    defaultZoom: params.config?.defaultZoom || 4,
    enableClustering: params.config?.enableClustering ?? true,
    enableSearch: params.config?.enableSearch ?? true,
    enableFilters: params.config?.enableFilters ?? true,
    itemsPerPage: params.config?.itemsPerPage || 10,
    markerIcons: params.config?.markerIcons,
    fieldRenderers: params.config?.fieldRenderers,
    autoDetectFieldTypes: params.config?.autoDetectFieldTypes ?? true,
  };

  // Start data fetch immediately — before React mounts — so network request
  // runs in parallel with React initialization and tile loading
  const adapter = createDataAdapter(config.dataSource);
  const dataPromise = adapter.fetchLocations();

  // Create widget store instance
  const store = createWidgetStore();

  // Create field renderer registry and set in store
  const fieldRendererRegistry = createFieldRendererRegistry({
    renderers: config.fieldRenderers,
    autoDetect: config.autoDetectFieldTypes,
  });
  store.getState().setFieldRendererRegistry(fieldRendererRegistry);

  // Create React root and render widget
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <StoreProvider store={store}>
        <Widget config={config} dataPromise={dataPromise} />
      </StoreProvider>
    </React.StrictMode>
  );
}

/**
 * Expose global API for embedding
 */
if (typeof window !== 'undefined') {
  (window as any).OpenMapEmbed = {
    init,
    parseURLConfig,
    embedOptionsToWidgetConfig,
    version: '1.0.0',
  };
}

// For module imports
export { init, Widget, parseURLConfig, embedOptionsToWidgetConfig };
export type { WidgetInitParams, WidgetConfig };
