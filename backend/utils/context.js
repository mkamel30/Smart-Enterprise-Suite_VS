const { AsyncLocalStorage } = require('async_hooks');

const contextStore = new AsyncLocalStorage();

/**
 * Get the current request context (user, correlationId, etc)
 * @returns {Object|undefined}
 */
const getContext = () => contextStore.getStore();

/**
 * Get the current user from context
 * @returns {Object|undefined}
 */
const getCurrentUser = () => {
    const context = getContext();
    return context?.user;
};

module.exports = {
    contextStore,
    getContext,
    getCurrentUser
};
