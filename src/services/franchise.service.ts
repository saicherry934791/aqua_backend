import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { franchiseAreas } from '../models/schema';
import { GeoLocation, GeoPolygon } from '../types';
import { isPointInPolygon, parseJsonSafe } from '../utils/helpers';

/**
 * Get a franchise area by its ID
 * @param id Franchise area ID
 * @returns Franchise area object or null if not found
 */
export async function getFranchiseAreaById(id: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.franchiseAreas.findFirst({
    where: eq(fastify.db.query.franchiseAreas.id, id),
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    geoPolygon: parseJsonSafe<GeoPolygon>(result.geoPolygon, { 
      type: 'Polygon', 
      coordinates: []
    }),
  };
}

/**
 * Get all franchise areas
 * @param includeInactive Whether to include inactive franchise areas
 * @returns Array of franchise areas
 */
export async function getAllFranchiseAreas(includeInactive = false) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const query = fastify.db.query.franchiseAreas;
  let results;
  
  if (includeInactive) {
    results = await query.findMany();
  } else {
    results = await query.findMany({
      where: (franchiseArea) => eq(franchiseArea.isActive, true),
    });
  }

  return results.map(result => ({
    ...result,
    geoPolygon: parseJsonSafe<GeoPolygon>(result.geoPolygon, { 
      type: 'Polygon', 
      coordinates: []
    }),
  }));
}

/**
 * Create a new franchise area
 * @param data Franchise area data
 * @returns Created franchise area
 */
export async function createFranchiseArea(data: {
  name: string;
  description?: string;
  geoPolygon: GeoPolygon;
  ownerId?: string;
  isCompanyManaged: boolean;
}) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const id = `franchise_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  await fastify.db.insert(franchiseAreas).values({
    id,
    name: data.name,
    description: data.description,
    geoPolygon: JSON.stringify(data.geoPolygon),
    ownerId: data.ownerId,
    isCompanyManaged: data.isCompanyManaged,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  });

  return getFranchiseAreaById(id);
}

/**
 * Find which franchise area a location belongs to
 * @param location GeoLocation to check
 * @returns ID of the franchise area the location belongs to, or undefined if none found
 */
export async function findFranchiseAreaForLocation(location: GeoLocation): Promise<string | undefined> {
  try {
    const allAreas = await getAllFranchiseAreas();

    for (const area of allAreas) {
      if (isPointInPolygon(location, area.geoPolygon)) {
        return area.id;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('Error finding franchise area for location:', error);
    return undefined;
  }
}

/**
 * Get franchise areas by owner ID
 * @param ownerId Owner ID
 * @returns Array of franchise areas owned by the user
 */
export async function getFranchiseAreasByOwner(ownerId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const results = await fastify.db.query.franchiseAreas.findMany({
    where: (franchiseArea) => eq(franchiseArea.ownerId, ownerId),
  });

  return results.map(result => ({
    ...result,
    geoPolygon: parseJsonSafe<GeoPolygon>(result.geoPolygon, { 
      type: 'Polygon', 
      coordinates: []
    }),
  }));
}

/**
 * Update a franchise area
 * @param id Franchise area ID
 * @param data Data to update
 * @returns Updated franchise area
 */
export async function updateFranchiseArea(
  id: string,
  data: {
    name?: string;
    description?: string;
    geoPolygon?: GeoPolygon;
    ownerId?: string;
    isCompanyManaged?: boolean;
    isActive?: boolean;
  }
) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const updateData: any = {
    updatedAt: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.geoPolygon !== undefined) updateData.geoPolygon = JSON.stringify(data.geoPolygon);
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
  if (data.isCompanyManaged !== undefined) updateData.isCompanyManaged = data.isCompanyManaged;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await fastify.db
    .update(franchiseAreas)
    .set(updateData)
    .where(eq(franchiseAreas.id, id));

  return getFranchiseAreaById(id);
}