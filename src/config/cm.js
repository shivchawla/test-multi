
import mongoose from 'mongoose';
import path from 'path';
import { getNamespace, createNamespace } from 'cls-hooked';
import {log} from './logger';
import { getAllOrganizations } from '../services/organization.service';

let tenantMapping;

// Not in use currently (Was originally created for Document DB).
// Not needed to connect with MongoDB docker installation
const awsConnectionOptions = {
  ssl: true, 
  sslCA: `${path.resolve('./')}/rds-combined-ca-bundle.pem`,
  replicaSet: 'rs0',
  readPreference: 'secondaryPreferred',
  retryWrites: false
};

const parseBool = (x = "") => x.toLowerCase() == "true" 

/**
 * Create database connection
 * @return mongoose database connection
 */
const connectDb = async (config) => {
  try {
    //Mongoose "connect" will return this (so "connect" WILL NOT work for different databases;
    //Use createConnection instead
    let conn = mongoose.createConnection(config.uri, config.options);
    log.info(`Connected to the database: ${config.uri}`);
    return conn;
  } catch (error) {
    log.error('Could not connect to the database.', error);
  }
};

/**
 * Connection to common database
 */
export const getCommonDatabase = async() => {

  const useAws = parseBool(process.env.DB_USE_AWS);
  const authSource = process.env.AUTH_DB_NAME;

  const commonDbConn = {
    uri: `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}`,
    options: {
      dbName: process.env.DB_NAME,
      user: process.env.DB_USER,
      pass: process.env.DB_PWD,
      ...!!authSource && {authSource},
      ...useAws && awsConnectionOptions
    }
  }

  return connectDb(commonDbConn);
}

/**
 * Get connection configuration for tenant
 * @param {*} tenant 
 * @returns connection configuration object
 */
const getConnectionConfig = (tenant) => {   
  const { user, name: dbName, pass, host, port } = tenant?.database;  
  const useAws = parseBool(process.env.DB_USE_AWS);
  const authSource = process.env.AUTH_DB_NAME;

  const conf = {     
    uri: `mongodb://${host}:${port}`, 
    options: {            
      user,       
      dbName,     
      pass,
      ...!!authSource && {authSource},
      ...useAws && awsConnectionOptions
    }  
  }

  return conf;
} 

/**
 * Connect to all databases for all tenants
 */
export const connectAllDb = async () => { 
  try {     
    const tenants = await getAllOrganizations(); 
    tenantMapping = await Promise.all(tenants.map(async (tenant) => ({     
      code: tenant.code,
      camundaTenantId: tenant.camundaTenantId,                  
      conn: await connectDb(getConnectionConfig(tenant))
    })))
    
    // .then(arr => arr.reduce((prev, next) => {
    //   return Object.assign({}, prev, next)
    // }, {}));  

  } catch (e) {   
    log.error(e.message)   
  } 
} 

/**
 * Get tenant connection based on tenant's organization code
 * @param {*} code 
 * @returns 
 */
export const getTenantConnection = (code) => {   
  const tenant = tenantMapping.find(it => it.code == code);
  if (!tenant || !tenant?.conn) return null;
  return tenant;
} 

/**
 * Configure connections at startup
 */
export const configureConnectionManager = async() => {
  //Initialize namespace for the application
  createNamespace(process.env.NAMESPACE);
  await connectAllDb();
}

/**
 * 
 * @returns Get spceific db connection for current context
 */
export const getConnection = async () => {
  const ns = await getNamespace(process.env.NAMESPACE);
  const conn = await ns.get('connection');
  if (!!!conn) {
    log.warn("Connection via namespace is null");
  }

  return conn;
}
