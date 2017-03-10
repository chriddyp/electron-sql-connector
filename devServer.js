import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import config from './webpack.config.development';

const app = express();
const compiler = webpack(config);
export const PORT = 3000;

app.use(webpackDevMiddleware(compiler, {
    quiet: true,
    publicPath: config.output.publicPath,
    stats: {
        colors: true
    }
}));

app.use(webpackHotMiddleware(compiler, {
    log: () => {}
}));

/* eslint no-console: 0 */
app.listen(PORT, 'localhost', err => {
    if (err) {
        console.error(err);
        return;
    }

    console.log(`Listening at http://localhost:${PORT}`);
});
