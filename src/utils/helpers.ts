import { nanoid } from 'nanoid';
import { GeoLocation, GeoPolygon } from '../types';

/**
 * Generate a unique ID for a specific entity
 * @param prefix The prefix for the ID, e.g., 'user', 'product', etc.
 * @returns A unique ID string
 */
export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(10)}`;
}

/**
 * Check if a point is inside a polygon
 * @param point The point coordinates
 * @param polygon The polygon coordinates
 * @returns true if the point is inside the polygon, false otherwise
 */
export function isPointInPolygon(point: GeoLocation, polygon: GeoPolygon): boolean {
  if (polygon.type !== 'Polygon' || !polygon.coordinates || !polygon.coordinates[0]) {
    return false;
  }

  const x = point.longitude;
  const y = point.latitude;
  
  const vs = polygon.coordinates[0]; // First polygon (we don't handle holes)
  
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Find which franchise area a point belongs to
 * @param point The point coordinates
 * @param franchiseAreas Array of franchise areas with their polygons
 * @returns The ID of the franchise area the point belongs to, or undefined if none found
 */
export function findFranchiseAreaForLocation(
  point: GeoLocation, 
  franchiseAreas: Array<{ id: string; geoPolygon: GeoPolygon }>
): string | undefined {
  for (const area of franchiseAreas) {
    if (isPointInPolygon(point, area.geoPolygon)) {
      return area.id;
    }
  }
  return undefined;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 The first point coordinates
 * @param point2 The second point coordinates
 * @returns Distance in kilometers
 */
export function calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
  const R = 6371; // Earth's radius in km
  const dLat = degToRad(point2.latitude - point1.latitude);
  const dLon = degToRad(point2.longitude - point1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(point1.latitude)) * Math.cos(degToRad(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse JSON string and handle errors
 * @param jsonString The JSON string to parse
 * @param defaultValue Default value to return on error
 * @returns Parsed object or default value on error
 */
export function parseJsonSafe<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Format a date to YYYY-MM-DD
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}