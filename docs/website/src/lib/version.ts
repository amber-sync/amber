/**
 * Website version utility
 * Reads from parent (root) package.json to ensure consistency with the app
 */
import parentPkg from '../../../package.json';

export const APP_VERSION = parentPkg.version;
export const APP_NAME = parentPkg.name;
export const APP_DESCRIPTION = parentPkg.description;
