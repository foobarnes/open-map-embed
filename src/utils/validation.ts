/**
 * Data validation utilities
 */

import type { Location, Address, Contact } from '../types';

/**
 * Validate if a value is a valid latitude
 */
export function isValidLatitude(lat: unknown): boolean {
  return typeof lat === 'number' && lat >= -90 && lat <= 90;
}

/**
 * Validate if a value is a valid longitude
 */
export function isValidLongitude(lng: unknown): boolean {
  return typeof lng === 'number' && lng >= -180 && lng <= 180;
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate and sanitize a location object
 */
export function validateLocation(data: Partial<Location>): Location | null {
  // Required fields
  if (!data.id || typeof data.id !== 'string') {
    console.warn('Invalid location: missing or invalid id');
    return null;
  }

  if (!data.name || typeof data.name !== 'string') {
    console.warn(`Invalid location ${data.id}: missing or invalid name`);
    return null;
  }

  if (!isValidLatitude(data.latitude)) {
    console.warn(`Invalid location ${data.id}: invalid latitude`);
    return null;
  }

  if (!isValidLongitude(data.longitude)) {
    console.warn(`Invalid location ${data.id}: invalid longitude`);
    return null;
  }

  if (!data.category || typeof data.category !== 'string') {
    console.warn(`Invalid location ${data.id}: missing or invalid category`);
    return null;
  }

  // Validate address
  if (!data.address) {
    console.warn(`Invalid location ${data.id}: missing address`);
    return null;
  }

  const address: Address = {
    city: data.address.city || '',
    state: data.address.state || '',
    street: data.address.street,
    zip: data.address.zip,
    country: data.address.country,
  };

  const hasCoordinates = isValidLatitude(data.latitude) && isValidLongitude(data.longitude);
  if (!hasCoordinates && (!address.city || !address.state)) {
    console.warn(`Invalid location ${data.id}: incomplete address and no valid coordinates`);
    return null;
  }

  // Validate optional contact info
  let contact: Contact | undefined = undefined;
  if (data.contact) {
    contact = {};
    if (data.contact.email) {
      if (isValidEmail(data.contact.email)) {
        contact.email = data.contact.email;
      } else {
        console.warn(`Invalid email for location ${data.id}`);
      }
    }
    if (data.contact.phone) {
      contact.phone = data.contact.phone;
    }
    if (data.contact.website) {
      if (isValidUrl(data.contact.website)) {
        contact.website = data.contact.website;
      } else {
        console.warn(`Invalid website URL for location ${data.id}`);
      }
    }
  }

  // Validate optional URL
  let url: string | undefined = undefined;
  if (data.url) {
    if (isValidUrl(data.url)) {
      url = data.url;
    } else {
      console.warn(`Invalid URL for location ${data.id}`);
    }
  }

  // Validate images array
  let images: string[] | undefined = undefined;
  if (data.images && Array.isArray(data.images)) {
    images = data.images.filter((img) => typeof img === 'string' && isValidUrl(img));
  }

  // Build validated location object
  const location: Location = {
    id: data.id,
    name: data.name,
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    category: data.category,
    description: data.description || '',
    address,
    contact,
    url,
    images,
    hours: data.hours,
    customFields: data.customFields,
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };

  return location;
}

/**
 * Validate an array of locations
 */
export function validateLocations(data: unknown[]): Location[] {
  if (!Array.isArray(data)) {
    console.error('Invalid data: expected array');
    return [];
  }

  const validLocations: Location[] = [];

  for (const item of data) {
    const validated = validateLocation(item as Partial<Location>);
    if (validated) {
      validLocations.push(validated);
    }
  }

  // Enhanced validation summary
  const invalidCount = data.length - validLocations.length;
  const successRate = data.length > 0 ? ((validLocations.length / data.length) * 100).toFixed(1) : '0.0';

  console.log(
    `📋 Validation Summary:\n` +
    `  Total items: ${data.length}\n` +
    `  Valid: ${validLocations.length}\n` +
    `  Invalid: ${invalidCount}\n` +
    `  Success rate: ${successRate}%`
  );

  if (invalidCount > 0) {
    console.warn(`⚠ ${invalidCount} location(s) failed validation (see warnings above for details)`);
  }

  return validLocations;
}

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
