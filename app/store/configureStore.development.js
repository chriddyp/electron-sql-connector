import { createStore, applyMiddleware, compose } from 'redux';
import { persistState } from 'redux-devtools';
import thunk from 'redux-thunk';
import createLogger from 'redux-logger';
import rootReducer from '../reducers';
import DevTools from '../containers/DevTools';

const logger = createLogger({
    level: 'info',
    collapsed: true
});

const enhancer = compose(
    applyMiddleware(thunk, logger),
    //  electronEnhancer(true), // ({test: true}),
    DevTools.instrument(),
    persistState(
        window.location.href.match(
            /[?&]debug_session=([^&]+)\b/
        )
    ),
    window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);

export default function configureStore(initialState) {
    const store = createStore(rootReducer, initialState, enhancer);

    if (module.hot) {
            module.hot.accept('../reducers', () =>
            store.replaceReducer(require('../reducers'))
        );
    }

    window.store = store;
    return store;
}
