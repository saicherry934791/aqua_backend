import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { ErrorResponseSchema } from "./auth.schema";


export const serviceAgentAddBody = z.object({
    name: z.string(),
    number: z.string(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    alternativeNumber: z.string().optional(),
    franchiseId: z.string().optional()

})



export const addServiceAgentSchema = {
    body: zodToJsonSchema(
        serviceAgentAddBody
    ),
    response: {

        400: zodToJsonSchema(ErrorResponseSchema),
        403: zodToJsonSchema(ErrorResponseSchema),
    },
    tags: ["Service Agents"],
    summary: "adding service agent",

    security: [{ bearerAuth: [] }],

}

export const getServcieAgentsSchema = {
    querystring: zodToJsonSchema(z.object({
        id:z.string().optional()
    })),
    response: {
        200: zodToJsonSchema(
            z.array(
                z.object({
                    name: z.string(),
                    number: z.string(),
                    franchiseName: z.string(),
                    franchiseId: z.string(),
                    serviceRequestsCount: z.number(),
                    ordersCount: z.number(),
                    active: z.boolean(),
                    email: z.string(),
                    joined: z.string(),
                    id:z.string(),
                    alternativePhone:z.string()

                })

            )
        ),
        400: zodToJsonSchema(ErrorResponseSchema),
        403: zodToJsonSchema(ErrorResponseSchema),
    },
    tags: ["Service Agents"],
    summary: "adding service agent",

    security: [{ bearerAuth: [] }],

}

export const PatchServcieAgentSchema  = {
    params : zodToJsonSchema(
        z.object(
          {
            id:z.string()
          }
        )
    ),
    response :{
        400: zodToJsonSchema(ErrorResponseSchema),
        403: zodToJsonSchema(ErrorResponseSchema),
    },
    
}