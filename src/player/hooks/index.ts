/**
 * AlphaTab Hooks
 * 
 * 简化 AlphaTab 集成的 React Hooks
 */

export {
    useAlphaTabPlayer,
    useAlphaTabPlayerSimple,
    type AlphaTabPlayerConfig
} from './useAlphaTabPlayer';

export {
    useAlphaTabEvent,
    useAlphaTabEvents,
    useAlphaTabEventOnce,
    useAlphaTabEventConditional,
    useAlphaTabEventDebounced,
    useAlphaTabEventThrottled,
    type AlphaTabEventHandler,
    type AlphaTabEventName
} from './useAlphaTabEvent';
