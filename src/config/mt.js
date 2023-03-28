import { getConnection, getCommonDatabase } from "./connectionManager";
import { log } from "./logger";

export const tenantModel = (model, schema) => {
    return async() => {
        const connection = await getConnection();
        if(!!!connection) {
            log.warn("Connection is undefined when building Tenant Model");
            return null;
        }
        
        const {code, tenantId, conn} = connection
        //Add organization code to every schema/document
        const nSchema = schema.add({ organization: String }).add({camundaTenantId: String});
        nSchema.pre('save', function (next) {
            if (!this.organization) {
              this.organization = code;
            }
            if (!this.camundaTenantId) {
                this.camundaTenantId = tenantId;
            }
            next();
        });

        return conn.model(model, nSchema);
    }
}
export const tenantLessModel = (model, schema) => {
    return async() => {
        const db = await getCommonDatabase();
        return db.model(model, schema);
    }
}
