import { getNamespace } from 'cls-hooked';
import { getTenantConnection } from '../config/connectionManager';
import { registerModels } from '../models';

export const bindCurrentNamespace = (req, res, next) => {

    // if (req.path.indexOf("/organization") === 0) { return next() };

    const ns = getNamespace(process.env.NAMESPACE);

    ns.bindEmitter(req);
    ns.bindEmitter(res);
  
    ns.run(() => {
      next();
    });
}

/**
 * Get the connection instance for the tenant uuid and set it to current context
 */
export const connectionResolver = async (req, res, next) => {

    // if (req.path.indexOf("/organization") === 0) { return next() };

    const code = req.query.code;
    if (!code) {
        return res.status(403).send({ message: "Please provide tenant's code to connect" });
    }

    let nameSpace = getNamespace(process.env.NAMESPACE);
    let tenant = getTenantConnection(code);

    if (tenant) {
        const tenantId = tenant.camundaTenantId;
        req.camundaTenantId = tenantId;
        await nameSpace.set('connection', {code, tenantId, conn: tenant.conn});
        
        //Register Models after resolving connection
        await registerModels();

        next();
    } else {
        return res.status(403).send({ message: `Tenant not found for code: ${code}` });
    }
}
