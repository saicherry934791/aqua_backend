import { serviceAgentAddBody } from "../schemas/serviceagent.schema";
import { getAllServiceAgentsFromDB, serviceAgentAddToDB, serviceAgentUpdate } from "../services/serviceagnet.service";
import { handleError } from "../utils/errors";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from 'zod'



export const addServiceAgent = async (request: FastifyRequest, reply: FastifyReply) => {


    try {
        await serviceAgentAddToDB(request.body as z.infer<typeof serviceAgentAddBody>)
        return reply.send(200)
    } catch (error) {
        return handleError(error, request, reply)
    }

}

export const getAllServiceAgents = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const {id} = request.query;
        const result = await getAllServiceAgentsFromDB(id);
        console.log('data is ',result)
        return reply.code(200).send(result)

    } catch (error) {
        return handleError(error, request, reply)
    }
}

export const updateServiceAgent = async (request:FastifyRequest,reply:FastifyReply) =>{
    try{
        const {id}= request.params
       
        await serviceAgentUpdate(id,request.body)

    }catch(error){
        return handleError(error,request,reply)
    }
}