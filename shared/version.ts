/**
 * Single source of truth for application version
 * Reads from root package.json to ensure consistency
 * across the entire application and website
 */
import packageJson from '../package.json';

export const APP_VERSION = packageJson.version;
export const APP_NAME = packageJson.name;
export const APP_DESCRIPTION = packageJson.description;
export const APP_AUTHOR = packageJson.author;
export const APP_HOMEPAGE = packageJson.homepage;

/**
 * Build metadata (can be enhanced with environment variables)
 */
export const BUILD_DATE = new Date().toISOString();
export const BUILD_ENV = process.env.NODE_ENV || 'development';
