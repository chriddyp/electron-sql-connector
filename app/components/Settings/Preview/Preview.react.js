import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {has, isEmpty, propOr} from 'ramda';

import SplitPane from 'react-split-pane';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

import TableTree from './TableTree.react.js';
import SQLTable from './sql-table.jsx';
import CodeEditor from './code-editor.jsx';
import ChartEditor from './chart-editor.jsx';
import ApacheDrillPreview from './ApacheDrillPreview.js';
import S3Preview from './S3Preview.js';

import OptionsDropdown from '../OptionsDropdown/OptionsDropdown.react';
import {Link} from '../../Link.react';
import {DIALECTS, PREVIEW_QUERY, SQL_DIALECTS_USING_EDITOR} from '../../../constants/constants.js';
import {homeUrl, isOnPrem} from '../../../utils/utils';

class Preview extends Component {
    static propTypes = {
        connections: PropTypes.object,
        connectionObject: PropTypes.object,

        selectedTab: PropTypes.string,
        selectedTable: PropTypes.any,
        selectedIndex: PropTypes.any,
        setTable: PropTypes.func,
        setIndex: PropTypes.func,

        preview: PropTypes.obj,
        updatePreview: PropTypes.func,

        tablesRequest: PropTypes.object,

        schemaRequest: PropTypes.object,
        getSqlSchema: PropTypes.func,

        runSqlQuery: PropTypes.func,
        openScheduler: PropTypes.func,
        previewTableRequest: PropTypes.object,
        queryRequest: PropTypes.object,
        elasticsearchMappingsRequest: PropTypes.object,

        username: PropTypes.string
    };

    constructor(props) {
        super(props);

        this.testClass = this.testClass.bind(this);
        this.updateCode = this.updateCode.bind(this);
        this.toggleEditor = this.toggleEditor.bind(this);
        this.runQuery = this.runQuery.bind(this);
        this.fetchDatacache = this.fetchDatacache.bind(this);

        this.state = Preview.checkQueryResults(this.props);
        this.state.plotlyJSON = {};
        this.state.plotlyLinks = [];
        this.state.timeQueryElapsedMsg = '';
    }

    static checkQueryResults(props) {
        const {
            preview,
            previewTableRequest,
            queryRequest
        } = props;
        const {lastSuccessfulQuery} = preview;

        let rows = [];
        let columnNames = [];
        let isLoading = false;
        let successMsg = '';

        let errorMsg = '';
        function setErrorMsg(error) {
            try {
                errorMsg = error.content.error.message;
            } catch (_) {
                errorMsg = JSON.stringify(error);
            }
            errorMsg = String(errorMsg).trim();
        }

        if (isEmpty(previewTableRequest) || previewTableRequest.status === 'loading') {
            isLoading = true;
        }
        else if (previewTableRequest.status !== 200) {
            setErrorMsg(previewTableRequest);
        }
        else if (isEmpty(queryRequest)) {
            rows = previewTableRequest.content.rows;
            columnNames = previewTableRequest.content.columnnames;
            successMsg = `${rows.length} rows retrieved`;
        }
        else if (queryRequest.status === 'loading') {

            if (has('lastSuccessfulQuery', preview)) {
                // The is at least the 2nd query the user has run
                rows = lastSuccessfulQuery.rows;
                columnNames = lastSuccessfulQuery.columnnames;
            } else {
                // The is the first query the user is running
                rows = previewTableRequest.content.rows;
                columnNames = previewTableRequest.content.columnnames;
            }
            isLoading = true;
        } else if (queryRequest.status !== 200) {
            if (has('lastSuccessfulQuery', preview)) {
                // user's query failed but they have made a succesful query in the past
                rows = lastSuccessfulQuery.rows;
                columnNames = lastSuccessfulQuery.columnnames;
            }
            else {
                // User has never made a succesful query on their own
                rows = previewTableRequest.content.rows;
                columnNames = previewTableRequest.content.columnnames;
                successMsg = `${rows.length} rows retrieved`;
            }
            setErrorMsg(queryRequest);
        }
        else {
            // User's query worked
            rows = queryRequest.content.rows;
            columnNames = queryRequest.content.columnnames;
            successMsg = `${rows.length} rows retrieved`;
        }

        return {
            rows,
            columnNames,
            isLoading,
            successMsg,
            errorMsg
        };
    }

    componentWillReceiveProps(nextProps) {
        const {
            preview,
            previewTableRequest,
            queryRequest
        } = nextProps;

        let hasChanged = (preview.lastSuccessfulQuery !== this.props.preview.lastSuccessfulQuery);

        hasChanged = hasChanged || (previewTableRequest.status !== this.props.previewTableRequest.status);
        hasChanged = hasChanged || (previewTableRequest.columnnames !== this.props.previewTableRequest.columnnames);
        hasChanged = hasChanged || (previewTableRequest.rows !== this.props.previewTableRequest.rows);

        hasChanged = hasChanged || (queryRequest.status !== this.props.queryRequest.status);
        hasChanged = hasChanged || (queryRequest.columnnames !== this.props.queryRequest.columnnames);
        hasChanged = hasChanged || (queryRequest.rows !== this.props.queryRequest.rows);

        if (hasChanged) {
            const nextState = Preview.checkQueryResults(nextProps);
            this.setState(nextState);
        }
    }

    getCSVString() {
        const {columnNames, rows} = this.state;

        let csvString = columnNames.join(', ') + '\n';
        rows.forEach(row => {
            csvString += row.join(', ') + '\n';
        });

        return csvString;
    }

    fetchDatacache(payload, type) {
        const {username} = this.props;
        const payloadJSON = JSON.stringify({
            payload: payload, type: type, requestor: username});

        fetch(homeUrl() + '/datacache', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: 'POST',
            credentials: 'include',
            body: payloadJSON
        }).then(resp => {
            return resp.json();
        }).then(data => {
            const {plotlyLinks} = this.state;

            let link;

            if (!('error' in data)) {
                link = plotlyLinks.find((l) => l.type === type);
                if (link) {
                    // if exists, overwrite it:
                    link.url = data.url;
                } else {
                    plotlyLinks.unshift({type: type, url: data.url});
                }

            } else {
                link = plotlyLinks.find((l) => l.type === 'error');
                if (link) {
                    // if exists, overwrite it:
                    link.message = data.error.message;
                }
                else {
                    plotlyLinks.unshift({type: 'error', message: data.error.message});
                }
            }
            this.setState({ plotlyLinks: plotlyLinks });
        });
    }

    testClass() {
        return 'test-connected';
    }

    runQuery() {
        const STARTED_AT = new Date();
        this.props.runSqlQuery().then(content => {
            /*
            * Cache the last successful query
            * lastSuccessfulQuery is the result of the last successful query
            * and should have the form {rows:[[]], columnnames:[]}
            * Update state.timeQueryElapsedMsg with the number of seconds took by
            * the query.
            */
            if (!has('error', content) && has('rows', content) && has('columnnames', content)) {
                this.props.updatePreview({lastSuccessfulQuery: content});
                const milliSeconds = new Date().getTime() - STARTED_AT.getTime();
                // Keep 3 decimals
                const seconds = parseFloat((milliSeconds / 1000).toFixed(3));
                this.setState({ timeQueryElapsedMsg: `in ${seconds} seconds` });
            }
        });
    }

    updateCode(newCode) {
        this.props.updatePreview({
            code: newCode
        });
    }

    toggleEditor() {
        const showEditor = propOr(true, 'showEditor')(this.props.preview);
        this.props.updatePreview({
            showEditor: showEditor ? false : true
        });
    }

    render() {
        const {
            connections,
            connectionObject,
            elasticsearchMappingsRequest,
            getSqlSchema,
            preview,
            schemaRequest,
            selectedTab,
            selectedIndex,
            selectedTable,
            setIndex,
            setTable,
            tablesRequest,
            updatePreview
        } = this.props;

        const {
            columnNames,
            errorMsg,
            plotlyJSON,
            isLoading,
            rows,
            successMsg,
            timeQueryElapsedMsg
        } = this.state;

        const dialect = connectionObject.dialect;

        const minSize = 10;
        const defaultSize = 200;
        const maxSize = -400;
        const size = propOr(defaultSize, 'size')(preview);
        const lastSize = propOr(defaultSize, 'lastSize')(preview);

        const showEditor = propOr(true, 'showEditor')(preview);
        const showChart = propOr(false, 'showChart')(preview);

        const code = propOr(PREVIEW_QUERY(connectionObject, selectedTable), 'code')(preview);
        propOr('', 'error')(preview);

        // Surpressing ESLint cause restricting line length would harm JSX readability
        /* eslint-disable max-len */
        return (
            <SplitPane
                split="vertical"

                minSize={minSize}
                defaultSize={defaultSize}
                maxSize={maxSize}
                size={size}
                onChange={nextSize =>
                    this.props.updatePreview({
                        size: nextSize
                    })
                }

                style={{position: 'relative !important'}}
            >
                <div className="tree-view-container">
                    {SQL_DIALECTS_USING_EDITOR.includes(dialect) &&
                        <TableTree
                            connectionObject={connections[selectedTab]}
                            preview={preview || {}}
                            updatePreview={updatePreview}

                            getSqlSchema={getSqlSchema}
                            schemaRequest={schemaRequest}
                        />
                    }
                </div>
                <div>
                    <div className={'previewContainer'}>
                        <div>
                            {SQL_DIALECTS_USING_EDITOR.includes(dialect) &&
                                <div>
                                    <code>
                                        <small>
                                            <a onClick={this.toggleEditor}>
                                                {showEditor ? 'Hide Editor' : 'Show Editor'}
                                            </a>
                                        </small>
                                    </code>

                                    <div
                                        style={{
                                            display: showEditor ? 'block' : 'none',
                                            position: 'relative',
                                            marginBottom: 20
                                        }}
                                    >
                                        <CodeEditor
                                            value={code}
                                            onChange={this.updateCode}

                                            dialect={dialect}
                                            runQuery={this.runQuery}
                                            openScheduler={this.props.openScheduler}
                                            schemaRequest={schemaRequest}
                                            isLoading={isLoading}
                                        />
                                    </div>
                                </div>
                            }

                            {!SQL_DIALECTS_USING_EDITOR.includes(dialect) &&
                                <OptionsDropdown
                                    connectionObject={connectionObject}
                                    selectedTable={selectedTable}
                                    elasticsearchMappingsRequest={elasticsearchMappingsRequest}
                                    tablesRequest={tablesRequest}
                                    setTable={setTable}
                                    setIndex={setIndex}
                                    selectedIndex={selectedIndex}
                                />
                            }
                        </div>

                        {errorMsg && showEditor &&
                            <div className="errorStatus">
                                <pre>{`ERROR: ${errorMsg}`}</pre>
                            </div>
                        }

                        {dialect !== DIALECTS.S3 && dialect !== DIALECTS.APACHE_DRILL &&
                            <div>
                                <Tabs
                                    forceRenderTabPanel={true}
                                    onSelect={(index, lastIndex) => {
                                        if (index === lastIndex) {
                                            return;
                                        }

                                        const chartEditorSelected = (index === 1);
                                        const schemasVisible = (size > minSize);
                                        if (chartEditorSelected) {
                                            if (schemasVisible) {
                                                // If Chart Editor selected and Schemas Tree visible,
                                                // then save size in lastSize before hiding
                                                this.props.updatePreview({
                                                    // uncomment to hide sql editor
                                                    // showEditor: false,
                                                    showChart: true,
                                                    lastSize: size,
                                                    size: minSize
                                                });
                                            } else {
                                                this.props.updatePreview({
                                                    // uncomment to hide sql editor
                                                    // showEditor: false,
                                                    showChart: true
                                                });
                                            }
                                        } else {
                                            if (!schemasVisible) {
                                                // If Chart Editor not selected and Schemas Tree was hidden,
                                                // then restore the last size
                                                this.props.updatePreview({
                                                    // uncomment to show sql editor
                                                    // showEditor: true,
                                                    showChart: false,
                                                    size: lastSize
                                                });
                                            } else {
                                                this.props.updatePreview({
                                                    // uncomment to show sql editor
                                                    // showEditor: true,
                                                    showChart: false
                                                });
                                            }
                                        }
                                    }}
                                >
                                    <TabList
                                        style={{userSelect: 'none'}}
                                    >
                                        <Tab>Table</Tab>
                                        {!isOnPrem() && <Tab>Chart</Tab>}
                                        {!isOnPrem() && <Tab>Export</Tab>}
                                    </TabList>

                                    <TabPanel
                                        style={{fontFamily: "'Ubuntu Mono', courier, monospace"}}
                                    >
                                        <SQLTable
                                            rows={rows}
                                            columnNames={columnNames}
                                        />
                                    </TabPanel>

                                    {!isOnPrem() &&
                                    <TabPanel>
                                        <ChartEditor
                                            ref="chartEditor"

                                            rows={rows}
                                            columnNames={columnNames}

                                            plotlyJSON={plotlyJSON}
                                            onUpdate={(nextPlotlyJSON) => this.setState({plotlyJSON: nextPlotlyJSON})}

                                            hidden={!showChart}
                                        />
                                    </TabPanel>}

                                    {!isOnPrem() &&
                                    <TabPanel>
                                        <div className="export-options-container" style={{ marginTop: 20 }}>
                                            <div className="container-title">CHART STUDIO</div>
                                            <div className="export-options-group">
                                              <button
                                                  className="btn btn-outline"
                                                  onClick={() => this.fetchDatacache(
                                                      JSON.stringify(this.state.plotlyJSON),
                                                      'plot'
                                                  )}
                                              >
                                                  Upload Chart
                                              </button>
                                              <button
                                                  className="btn btn-outline"
                                                  onClick={() => this.fetchDatacache(this.getCSVString(), 'grid')}
                                              >
                                                  Upload Dataset
                                              </button>
                                            </div>
                                            <div className="container-title">MY COMPUTER</div>
                                            <div className="export-options-group">
                                              <button
                                                  className="btn btn-outline"
                                                  onClick={() => window.open(
                                                      `data:text/csv;base64,${Buffer.from(this.getCSVString()).toString('base64')}`
                                                  )}
                                              >
                                                  Download CSV
                                              </button>
                                            </div>
                                            <div style={{width: 650, height: 200, border: '1px solid #dfe8f3',
                                                fontFamily: '\'Ubuntu Mono\', courier, monospace', paddingTop: 10,
                                                padding: 20, marginTop: 10, overflow: 'hidden', overflowY: 'scroll'}}
                                            >
                                                {this.state.plotlyLinks.map(link => (
                                                    <div style={{borderTop: '1px solid #dfe8f3', marginTop: 20}}>
                                                        {link.type === 'grid' &&
                                                            <div>
                                                                <div style={{color: '#00cc96'}}>🎉  Link to your CSV on Chart Studio ⬇️</div>
                                                                <Link href={link.url} target="_blank" className="externalLink">{link.url}</Link>
                                                            </div>
                                                        }
                                                        {link.type === 'plot' &&
                                                            <div>
                                                                <div style={{color: '#00cc96'}}>📈  Link to your chart on Chart Studio ⬇️</div>
                                                                <Link href={link.url} target="_blank" className="externalLink">{link.url}</Link>
                                                            </div>
                                                        }
                                                        {link.type === 'error' &&
                                                            <div>
                                                                <div style={{color: '#D36046'}}>{`[ERROR] ${link.message}`}</div>
                                                            </div>
                                                        }
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </TabPanel>}
                                </Tabs>
                            </div>
                        }

                        {successMsg &&
                            <div className="successMsg">
                                <p>{successMsg} {timeQueryElapsedMsg}</p>
                            </div>
                        }

                       {S3Preview(this.props)}
                       {ApacheDrillPreview(this.props)}
                    </div>
                </div>
            </SplitPane>
        );
        /* eslint-enable max-len */
    }
}

export default connect()(Preview);
