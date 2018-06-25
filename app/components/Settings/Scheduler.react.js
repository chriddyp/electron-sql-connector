import React, {Component} from 'react';
import PropTypes from 'prop-types';

import ReactDataGrid from 'react-data-grid';
import ms from 'ms';

const Row = props => (
  <div
    className="row" {...props}
    style={{ display: 'flex', justifyContent: 'space-around', width: '100%', ...props.style }}
  >
    {props.children}
  </div>
);

const Column = props => (
  <Row {...props} style={{ flexDirection: 'column', ...props.style }} />
);

const Tag = ({ title, color }) => (
  <span
    style={{
      display: 'inline-block',
      textAlign: 'center',
      backgroundColor: color,
      color: 'white',
      padding: '2px 4px',
      fontSize: 16,
      marginRight: '1rem',
      borderRadius: '2px'
    }}
  >
    {title}
  </span>
);

class QueryFormatter extends React.Component {
  static propTypes = {
    value: PropTypes.object
  }

  render() {
    const query = this.props.value;
    return (
      <Row
        style={{
          borderLeft: `2px solid ${query.status === 'SUCCESS' ? '#30aa65' : '#ef595b'}`
        }}
      >
        <Column style={{ padding: '0 24px' }}>
          <div style={{ fontSize: 18 }}>
            {query.query}
          </div>
          <em style={{ fontSize: 12 }}>
            {query.interval}
          </em>
        </Column>
        <Column style={{ padding: '0 24px' }}>
          <div>
            {query.tags.map(Tag)}
          </div>
        </Column>
      </Row>
    );
  }
}

class RunFormatter extends React.Component {
  static propTypes = {
    value: PropTypes.object
  }

  render() {
    const run = this.props.value;
    return (
      <Row>
        <Column style={{ padding: '0 24px' }}>
          <div
            style={{
              fontSize: 18,
              color: run.status === 'SUCCESS' ? '#30aa65' : '#ef595b'
            }}
          >
            {`${ms(Date.now() - run.last_run, { long: true })} ago`}
          </div>
          <em style={{ fontSize: 12 }}>
            {`${run.size} rows in ${ms(run.time, { long: true })}`}
          </em>
        </Column>
      </Row>
    );
  }
}

const SORT = {
  recent: (a, b) => b.last_run - a.last_run,
  latent: (a, b) => a.last_run - b.last_run,
  longest: (a, b) => b.time - a.time,
  shortest: (a, b) => a.time - b.time,
  most: (a, b) => b.size - a.size,
  least: (a, b) => a.size - b.size
};

function mapRows (sortFnKey, rows) {
  return rows
    .sort(SORT[sortFnKey])
    .map(r => ({
      query: r,
      run: r
    }));
}

class Scheduler extends Component {
  // TODO props
  rows = [
    {
      query: 'SELECT * FROM stripe.customers',
      interval: 'Runs every 15 minutes',
      tags: [{ title: 'XERO', color: '#f2c94c' }],
      status: 'SUCCESS',
      last_run: 1500,
      size: 115,
      time: 50 * 1000
    },
    {
      query: 'SELECT * FROM amex.customers',
      interval: 'Runs every Tuesday at 3:00pm',
      tags: [{ title: 'XERO', color: '#f2c94c' }, { title: 'Important', color: '#56ccf2' }],
      status: 'SUCCESS',
      last_run: 1500,
      size: 64,
      time: 3 * 60 * 1000
    },
    {
      query: 'SELECT * FROM amex.customers',
      interval: 'Runs every Tuesday at 3:00pm',
      tags: [{ title: 'Stage 2', color: '#d14cf2' }],
      status: 'ERROR',
      last_run: 1500,
      size: 0,
      time: 3000
    }
  ]
  constructor(props) {
    super(props);
    this.state = {
      rows: mapRows('recent', this.rows)
    };
    this.sort = this.sort.bind(this);
  }

  sort(sortFnKey) {
    this.setState(mapRows(sortFnKey, this.rows));
  }

  columns = [
    {
      key: 'query',
      name: 'Query',
      width: 650,
      filterable: true,
      formatter: QueryFormatter
    },
    {
      key: 'run',
      name: 'Last run',
      width: 450,
      filterable: true,
      formatter: RunFormatter
    }
  ]

  render() {
    return (
      <React.Fragment>
        <Row
          style={{
            marginTop: 24,
            marginBottom: 24,
            justifyContent: 'space-between'
          }}
        >
          <input placeholder="Search scheduled queries..."/>
          <button style={{ marginRight: '16px' }}>Create Scheduled Query</button>
        </Row>
        <Row style={{ marginBottom: 16, padding: '0 16px', justifyContent: 'space-between' }}>
          <Column style={{ width: 300 }}>
            <Row>
              <Column style={{ borderRight: '1px solid grey', marginRight: 12 }}>
                {this.state.rows.length} queries
              </Column>
              <Column>
                Success ({this.state.rows.filter(r => r.status === 'SUCCESS').length})
              </Column>
              <Column>
                Error ({this.state.rows.filter(r => r.status === 'ERROR').length})
              </Column>
            </Row>
          </Column>
          <Column style={{ width: 300 }}>
            <Row>
              <Column>
                Tags ▼
              </Column>
              <Column style={{ borderRight: '1px solid grey', marginRight: 4 }}>
                Sort ▼
              </Column>
              <Column>
                <button style={{ marginRight: '32px' }}>⟳</button>
              </Column>
            </Row>
          </Column>
        </Row>
        <Row style={{ padding: '0 16px' }}>
          <ReactDataGrid
            ref={node => (this.grid = node)}
            columns={this.columns}
            rowGetter={index => this.state.rows[index]}
            rowsCount={this.state.rows.length}
            rowHeight={84}
            headerRowHeight={32}
          />
        </Row>
      </React.Fragment>
    );
  }
}

export default Scheduler;
