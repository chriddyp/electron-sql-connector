import fetch from 'node-fetch';
import {contains} from 'ramda';

import {generateAndSaveAccessToken} from '../utils/authUtils.js';
import {
    getAccessTokenCookieOptions,
    getUnsecuredCookieOptions
} from '../constants.js';
import Logger from '../logger.js';
import {getSetting} from '../settings.js';

/*
 * backend does not see `/external-data-connector` in on-prem (because it is proxied).
 * So these ESCAPED_ROUTES should work for on-prem as well.
 */
const ESCAPED_ROUTES = [
  new RegExp('^/$'),
  new RegExp('^/ping$'),
  new RegExp('^/login$'),
  new RegExp('^/static/'),
  new RegExp('^/oauth2$'),
  new RegExp('^/oauth2/callback$')
];

function accessTokenIsValid(access_token) {
    const currentTime = Date.now();
    return (getSetting('ACCESS_TOKEN') === access_token &&
            getSetting('ACCESS_TOKEN_EXPIRY') > currentTime);
}

export function PlotlyOAuth(electron) {

    return function isAuthorized(req, res, next) {
        const path = req.href();

        const clientId = process.env.PLOTLY_CONNECTOR_OAUTH2_CLIENT_ID ||
            'isFcew9naom2f1khSiMeAtzuOvHXHuLwhPsM7oPt';
        res.setCookie('db-connector-oauth2-client-id', clientId, getUnsecuredCookieOptions());

        const authEnabled = getSetting('AUTH_ENABLED');
        res.setCookie('db-connector-auth-enabled', authEnabled, getUnsecuredCookieOptions());

        if (!authEnabled) {
            return next();
        }

        // No Auth for electron apps:
        if (electron) {
            return next();
        }

        // If not logged in and on-promise private-mode, redirect to login page
        const plotlyAuthToken = req.cookies['plotly-auth-token'];
        const onprem = getSetting('IS_RUNNING_INSIDE_ON_PREM');
        if (path === '/' && !plotlyAuthToken && onprem) {
            return res.redirect('/external-data-connector/login', next);
        }

        // Auth is disabled for certain urls:
        if (ESCAPED_ROUTES.some(path.match.bind(path))) {
            return next();
        }

        if (accessTokenIsValid(req.cookies['db-connector-auth-token'])) {
            return next();
        }

        if (!plotlyAuthToken) {
            res.json(401, {error: {message: 'Please login to access this page.'}});
            return next(false);
        }

        fetch(`${getSetting('PLOTLY_API_URL')}/v2/users/current`, {
            headers: {'Authorization': `Bearer ${plotlyAuthToken}`}
        })
        .then(userRes => {
            if (userRes.status !== 200) {
                return userRes.text().then(body => {
                    const errorMessage = `Error fetching user. Status: ${userRes.status}. Body: ${body}.`;
                    Logger.log(errorMessage, 0);
                    res.json(500, {error: {message: errorMessage}});
                    return next();
                });
            }

            return userRes.json().then(userMeta => {
                if (!userMeta.username || !contains(userMeta.username, getSetting('ALLOWED_USERS'))) {
                    // Remove any existing credentials and return error
                    res.clearCookie('db-connector-auth-token');
                    res.clearCookie('plotly-auth-token');
                    res.clearCookie('db-connector-user');
                    res.json(403, {error: {message: `User ${userMeta.username} is not allowed to view this app`}});
                    return next(false);
                }

                const dbConnectorAccessToken = generateAndSaveAccessToken();
                res.setCookie('db-connector-auth-token', dbConnectorAccessToken, getAccessTokenCookieOptions());

                return next();
            });
        })
        .catch(err => {
            Logger.log(err, 0);
            res.json(500, {error: {message: err.message}});
            return next(false);
        });
    };
}
