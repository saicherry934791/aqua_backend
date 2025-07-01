import { FastifyInstance } from 'fastify';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { type franchiseArea, franchiseAreas, User, users } from '../models/schema';
import { GeoLocation, GeoPolygon, UserRole } from '../types';
import { isPointInPolygon, parseJsonSafe, generateId, normalizePolygonCoordinates } from '../utils/helpers';
import { notFound, badRequest, forbidden, conflict } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get a franchise area by its ID
 * @param id Franchise area ID
 * @returns Franchise area object or null if not found
 */
export async function getFranchiseAreaById(id: string) {
  const fastify = getFastifyInstance();

  const result = await fastify.db.query.franchiseAreas.findFirst({
    where: eq(franchiseAreas.id, id),
    with: {
      owner: true,
    },
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    city: result.city,
    ownerId: result.ownerId,
    isCompanyManaged: !result.ownerId,
    geoPolygon: parseJsonSafe<GeoPolygon>(result.geoPolygon, {
      type: 'Polygon',
      coordinates: []
    }),
    createdAt: result.createdAt,
    isActive: result.isActive,
    revenue: 0,
    serviceAgentCount: 0,
    ownerName: result.owner?.name || "Company"
  };
}

/**
 * Get all franchise areas
 * @param includeInactive Whether to include inactive franchise areas
 * @returns Array of franchise areas
 */
export async function getAllFranchiseAreas(filters: any) {
  const fastify = getFastifyInstance();
  let whereClause: any = [];
  if (filters.isActive !== undefined) {
    whereClause.push(eq(franchiseAreas.isActive, filters.isActive));
  }
  const results = await fastify.db.run(
    sql`
      SELECT 
        fa.id,
        fa.name,
        fa.city,
        fa.geo_polygon as geoPolygon,
        fa.owner_id as ownerId,
        fa.is_company_managed as isCompanyManaged,
        fa.created_at as createdAt,
        fa.is_active as isActive,
        u.name as ownerName,
        '' as revenue, -- Placeholder, compute separately
        (
          SELECT COUNT(*) 
          FROM ${users} sa 
          WHERE sa.role = 'SERVICE_AGENT' AND sa.franchise_area_id = fa.id
        ) as serviceAgentCount
      FROM ${franchiseAreas} fa
      LEFT JOIN ${users} u ON u.id = fa.owner_id
    `
  ).then(res => res.rows);

  return results;
}

/**
 * Create a new franchise area
 * @param data Franchise area data
 * @returns Created franchise area
 */
export async function createFranchiseArea(data: any) {
  try {
    const { name, city, geoPolygon, phoneNumber } = data;
    const db = getFastifyInstance().db;
    const now = new Date().toISOString();

    if (phoneNumber) {
      const user = await db.query.users.findFirst({
        where: and(eq(users.phone, phoneNumber), eq(users.role, UserRole.FRANCHISE_OWNER))
      });

      if (user) {
        throw conflict("Franchise with phone number already present");
      }
    }

    // Normalize and store polygon coordinates
    const normalizedPolygon = normalizePolygonCoordinates(geoPolygon);

    // Create franchise area
    const franchiseAreaId = uuidv4();
    const createdFranchiseArea = await db.transaction(async (tx) => {
      const [createdFranchiseArea] = await tx
        .insert(franchiseAreas)
        .values({
          id: franchiseAreaId,
          name,
          city,
          geoPolygon: JSON.stringify(normalizedPolygon),
          isCompanyManaged: !phoneNumber,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (phoneNumber) {
        await tx
          .insert(users)
          .values({
            phone: phoneNumber,
            id: uuidv4(),
            role: UserRole.FRANCHISE_OWNER,
            franchiseAreaId,
            createdAt: now,
            updatedAt: now,
            isActive: true,
          });

        // Update the franchise area with owner ID
        await tx
          .update(franchiseAreas)
          .set({ ownerId: uuidv4() })
          .where(eq(franchiseAreas.id, franchiseAreaId));
      }

      // Update customers' franchise IDs based on location
      await updateCustomersFranchiseIds(createdFranchiseArea);

      return createdFranchiseArea;
    });

    // Return the created franchise area
    return {
      id: createdFranchiseArea.id,
      name: createdFranchiseArea.name,
      city: createdFranchiseArea.city,
      geoPolygon: createdFranchiseArea.geoPolygon,
      isCompanyManaged: createdFranchiseArea.isCompanyManaged,
    };

  } catch (e) {
    console.log('error in creating franchise area ', e);
    throw e;
  }
}

/**
 * Find which franchise area a location belongs to
 * @param location GeoLocation to check
 * @returns ID of the franchise area the location belongs to, or undefined if none found
 */
export async function findFranchiseAreaForLocation(location: GeoLocation): Promise<string | undefined> {
  try {
    const fastify = getFastifyInstance();
    
    // Get all active franchise areas
    const allAreas = await fastify.db.query.franchiseAreas.findMany({
      where: eq(franchiseAreas.isActive, true),
    });

    for (const area of allAreas) {
      let polygon;
      
      // Parse the stored polygon
      try {
        polygon = JSON.parse(area.geoPolygon);
      } catch (e) {
        console.error(`Error parsing polygon for franchise ${area.id}:`, e);
        continue;
      }
      
      if (isPointInPolygon(location, polygon)) {
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
 * Update customers' franchise area IDs based on their location
 * @param franchise The franchise area to check against
 */
export async function updateCustomersFranchiseIds(franchise: franchiseArea) {
  try {
    const db = getFastifyInstance().db;

    // Get all customers without franchise area or with location
    const allCustomers = await db.query.users.findMany({
      where: eq(users.role, UserRole.CUSTOMER),
    });

    const polygon = JSON.parse(franchise.geoPolygon);
    
    const matchingUserIds = allCustomers
      .filter((user: User) => {
        if (!user.locationLatitude || !user.locationLongitude) {
          return false;
        }
        
        return isPointInPolygon(
          {
            latitude: user.locationLatitude,
            longitude: user.locationLongitude,
          },
          polygon
        );
      })
      .map((user: User) => user.id);

    if (matchingUserIds.length > 0) {
      await db
        .update(users)
        .set({ 
          franchiseAreaId: franchise.id,
          updatedAt: new Date().toISOString()
        })
        .where(inArray(users.id, matchingUserIds));
    }
  } catch (e) {
    console.error('Error updating franchise IDs:', e);
  }
}

/**
 * Assign franchise area to user based on location
 * @param userId User ID
 * @param location User's location
 * @returns Updated user or null if no franchise area found
 */
export async function assignFranchiseAreaToUser(userId: string, location: GeoLocation): Promise<string | null> {
  try {
    const franchiseAreaId = await findFranchiseAreaForLocation(location);
    
    if (franchiseAreaId) {
      const db = getFastifyInstance().db;
      await db
        .update(users)
        .set({ 
          franchiseAreaId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, userId));
      
      return franchiseAreaId;
    }
    
    return null;
  } catch (error) {
    console.error('Error assigning franchise area to user:', error);
    return null;
  }
}

/**
 * Get franchise areas by owner ID
 * @param ownerId Owner ID
 * @returns Array of franchise areas owned by the user
 */
export async function getFranchiseAreasByOwner(ownerId: string) {
  const fastify = getFastifyInstance();

  const results = await fastify.db.query.franchiseAreas.findMany({
    where: eq(franchiseAreas.ownerId, ownerId),
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
export async function updateFranchiseArea(id: string, data: any) {
  const fastify = getFastifyInstance();
  const area = await getFranchiseAreaById(id);
  if (!area) throw notFound('Franchise Area');
  
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.geoPolygon) {
    const normalizedPolygon = normalizePolygonCoordinates(data.geoPolygon);
    updateData.geoPolygon = JSON.stringify(normalizedPolygon);
  }
  if (data.isCompanyManaged !== undefined) updateData.isCompanyManaged = data.isCompanyManaged;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  await fastify.db.update(franchiseAreas).set(updateData).where(eq(franchiseAreas.id, id));
  
  // If polygon was updated, reassign customers
  if (data.geoPolygon) {
    const updatedArea = await fastify.db.query.franchiseAreas.findFirst({
      where: eq(franchiseAreas.id, id)
    });
    if (updatedArea) {
      await updateCustomersFranchiseIds(updatedArea);
    }
  }
  
  return await getFranchiseAreaById(id);
}

/**
 * Assign franchise owner
 * @param id Franchise area ID
 * @param ownerId Owner ID
 * @returns Updated franchise area
 */
export async function assignFranchiseOwner(id: string, ownerId: string) {
  const fastify = getFastifyInstance();
  const area = await getFranchiseAreaById(id);
  if (!area) throw notFound('Franchise Area');
  const owner = await fastify.db.query.users.findFirst({ where: eq(users.id, ownerId) });
  if (!owner) throw notFound('User');
  
  // Set user role if not already franchise owner
  if (owner.role !== UserRole.FRANCHISE_OWNER) {
    await fastify.db.update(users).set({ role: UserRole.FRANCHISE_OWNER }).where(eq(users.id, ownerId));
  }
  
  await fastify.db.update(franchiseAreas).set({ 
    ownerId, 
    isCompanyManaged: false,
    updatedAt: new Date().toISOString() 
  }).where(eq(franchiseAreas.id, id));
  
  return await getFranchiseAreaById(id);
}

/**
 * Assign service agent to franchise area
 * @param id Franchise area ID
 * @param agentId Agent ID
 * @param user User object
 * @returns Updated agent object
 */
export async function assignServiceAgent(id: string, agentId: string, user: any) {
  const fastify = getFastifyInstance();
  const area = await getFranchiseAreaById(id);
  if (!area) throw notFound('Franchise Area');
  
  // Only admin or franchise owner of this area can assign
  if (
    user.role !== UserRole.ADMIN &&
    !(user.role === UserRole.FRANCHISE_OWNER && area.ownerId === user.userId)
  ) {
    throw forbidden('You do not have permission to assign agents to this area');
  }
  
  const agent = await fastify.db.query.users.findFirst({ where: eq(users.id, agentId) });
  if (!agent) throw notFound('User');
  
  // Set user role if not already service agent
  if (agent.role !== UserRole.SERVICE_AGENT) {
    await fastify.db.update(users).set({ role: UserRole.SERVICE_AGENT }).where(eq(users.id, agentId));
  }
  
  // Assign agent to this area
  await fastify.db.update(users).set({ 
    franchiseAreaId: id,
    updatedAt: new Date().toISOString()
  }).where(eq(users.id, agentId));
  
  return await fastify.db.query.users.findFirst({ where: eq(users.id, agentId) });
}

/**
 * Get all service agents for a franchise area
 * @param id Franchise area ID
 * @returns Array of service agents
 */
export async function getServiceAgents(id: string) {
  const fastify = getFastifyInstance();
  const agents = await fastify.db.query.users.findMany({
    where: and(eq(users.franchiseAreaId, id), eq(users.role, UserRole.SERVICE_AGENT)),
  });
  return agents;
}

/**
 * Get all service agents in a franchise area and global agents
 * @param franchiseAreaId Franchise area ID
 * @returns Array of service agents (franchise + global)
 */
export async function getAllAvailableServiceAgents(franchiseAreaId?: string) {
  const fastify = getFastifyInstance();
  
  let whereConditions = and(
    eq(users.role, UserRole.SERVICE_AGENT),
    eq(users.isActive, true)
  );
  
  // Get agents from the specific franchise area OR global agents (no franchise area assigned)
  if (franchiseAreaId) {
    whereConditions = and(
      eq(users.role, UserRole.SERVICE_AGENT),
      eq(users.isActive, true),
      // Either assigned to this franchise area OR global (no franchise area)
      sql`(${users.franchiseAreaId} = ${franchiseAreaId} OR ${users.franchiseAreaId} IS NULL)`
    );
  }
  
  const agents = await fastify.db.query.users.findMany({
    where: whereConditions,
  });
  
  return agents;
}