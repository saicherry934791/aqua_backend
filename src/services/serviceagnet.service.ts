import { getFastifyInstance } from '../shared/fastify-instance';
import { serviceAgentAddBody } from '../schemas/serviceagent.schema';
import { z } from 'zod';
import { franchiseAreas, orders, serviceRequests, users } from '../models/schema';
import { generateId } from '../utils/helpers';
import { UserRole } from '../types';
import { sql, eq } from 'drizzle-orm';
import { notFound } from '../utils/errors';

// Infer TypeScript type from Zod schema
type ServiceAgentInput = z.infer<typeof serviceAgentAddBody>;

export const serviceAgentAddToDB = async (data: ServiceAgentInput) => {
    const db = getFastifyInstance().db;

    console.log('data in adding agent is ',data)
    await db.insert(users).values({
        id: await generateId('agent'),
        name: data.name,
        phone: data.number,
        email: data.email || null,
        alternativePhone: data.alternativeNumber || null,
        role: UserRole.SERVICE_AGENT,
        franchiseAreaId: data.franchiseId || null

    });

};
export const getAllServiceAgentsFromDB = async (id?: string) => {
    const db = getFastifyInstance().db;

    const baseQuery = db
        .select({
            name: users.name,
            number: users.phone,
            franchiseName: franchiseAreas.name,
            franchiseId: users.franchiseAreaId,
            serviceRequestsCount: sql<number>`COUNT(DISTINCT ${serviceRequests.id})`,
            ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})`,
            active: users.isActive,
            email: users.email,
            joined: users.createdAt,
            id: users.id,
            alternativePhone:users.alternativePhone
        })
        .from(users)
        .leftJoin(franchiseAreas, eq(users.franchiseAreaId, franchiseAreas.id))
        .leftJoin(serviceRequests, eq(serviceRequests.assignedToId, users.id))
        .leftJoin(orders, eq(orders.serviceAgentId, users.id))
        .where(eq(users.role, UserRole.SERVICE_AGENT))
        .groupBy(users.id);


    if (id) {
        baseQuery.where(eq(users.id, id));
    }

    const agents = await baseQuery;

    console.log('service agents ', agents);
    return agents;
};


export const serviceAgentUpdate  = async (id:string,data:{
    name:string,
    phoneNumber:string,
    email:string,
    address : string,
    alertnatePhone:string,
    franchiseId:string

})=>{

    const db = getFastifyInstance().db;

    const agent = await db.query.users.findFirst({
        where: eq(users.id,id)
    })

    if(!agent){
        throw notFound("Agent Not Found,unable to update")
    }
    const updateData: any = { updatedAt: new Date().toISOString() };
    if(data.name) updateData.name =data.name;
    if(data.phoneNumber) updateData.phone = data.phoneNumber
    if(data.email) updateData.email = data.email
    if(data.alertnatePhone) updateData.alternativePhone = data.alertnatePhone
    if(data.franchiseId) updateData.franchiseAreaId = data.franchiseId

    await db.update(users).set(updateData).where(eq(users.id,id))




}