import { addServiceAgent, getAllServiceAgents } from "../controllers/serviceagent.controller";
import { addServiceAgentSchema, getServcieAgentsSchema } from "../schemas/serviceagent.schema";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {

    fastify.post("/", { schema: addServiceAgentSchema }, async (request, reply) => await addServiceAgent(request, reply)),

    fastify.get("/", { schema: getServcieAgentsSchema }, async (request, reply) => await getAllServiceAgents(request,reply))

    fastify.patch("/:id", { schema: getServcieAgentsSchema }, async (request, reply) => await getAllServiceAgents(request,reply))

}