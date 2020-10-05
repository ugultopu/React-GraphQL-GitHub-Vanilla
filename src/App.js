import React, { Component } from 'react';
import axios from 'axios';

const axiosGitHubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`,
  },
});

const TITLE = 'React GraphQL GitHub Client';

const GET_ISSUES_OF_REPOSITORY = `
  query (
    $organization: String!,
    $repository: String!,
    $cursor: String
  ) {
    organization(login: $organization) {
      name
      url
      repository(name: $repository) {
        name
        url
        issues(first: 5, after: $cursor, states: [OPEN]) {
          edges {
            node {
              id
              title
              url
              reactions(last: 3) {
                edges {
                  node {
                    id
                    content
                  }
                }
              }
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

const getIssuesOfRepository = (path, cursor) => {
  const [organization, repository] = path.split('/');
  return axiosGitHubGraphQL.post('', {
    query: GET_ISSUES_OF_REPOSITORY,
    variables: {organization, repository, cursor},
  });
}

/*
 * Had we NOT used Strict Mode in React, the function below could have
 * simply been:
 *
 *     const resolveIssuesQuery = (queryResult, cursor) => state => {
 *       const {data: {organization}, errors} = queryResult.data;
 *
 *       if (!cursor) return {organization, errors};
 *
 *       organization.repository.issues.edges = [
 *         ...state.organization.repository.issues.edges,
 *         ...organization.repository.issues.edges,
 *       ];
 *
 *       return {organization, errors};
 *     };
 *
 * This is because the version above MUTATES the arguments. That is, it
 * is not pure. Hence, when React calls it twice on purpose (because of
 * the Strict Mode), the program breaks. The reason that React calls it
 * twice is in order to detect if there are any problems ("hacks", bad
 * practices) such as this (such as modifying the function arguments
 * instead of treating them as immutable).
 */

const resolveIssuesQuery = (queryResult, cursor) => state => {
  const {data: {organization}, errors} = queryResult.data;

  if (!cursor) return {organization, errors};

  const { edges: oldIssues } = state.organization.repository.issues,
        { edges: newIssues } = organization.repository.issues,
        updatedIssues = [...oldIssues, ...newIssues];

  return {
    organization: {
      ...organization,
      repository: {
        ...organization.repository,
        issues: {
          ...organization.repository.issues,
          edges: updatedIssues
        },
      },
    },
    errors,
  };
};

class App extends Component {
  state = {
    path: 'the-road-to-learn-react/the-road-to-learn-react',
    organization: null,
    errors: null,
  };

  componentDidMount() {
    this.onFetchFromGitHub(this.state.path);
  }

  onChange = event => {
    this.setState({ path: event.target.value });
  }

  onSubmit = event => {
    this.onFetchFromGitHub(this.state.path);
    event.preventDefault();
  }

  onFetchFromGitHub = (path, cursor) => {
    getIssuesOfRepository(path, cursor).then(queryResult => {
      this.setState(resolveIssuesQuery(queryResult, cursor))
    });
  };

  onFetchMoreIssues = () => {
    this.onFetchFromGitHub(
      this.state.path,
      this.state.organization.repository.issues.pageInfo.endCursor
    );
  }

  render() {
    const {
      state: {
        path,
        organization,
        errors,
      },
      onFetchMoreIssues
    } = this;

    return (
      <div>
        <h1>{TITLE}</h1>

        <form onSubmit={this.onSubmit}>
          <label htmlFor="url">
            Show open issues for https://github.com/
          </label>
          <input
            id="url"
            type="text"
            value={path}
            onChange={this.onChange}
            style={{ width: '300px' }}
          />
          <button type="submit">Search</button>
        </form>

        <hr />

        {organization ? (
          <Organization {...{organization, errors, onFetchMoreIssues}}
          />
        ) : (
          <p>No information yet...</p>
        )}
      </div>
    );
  }
}

const Organization = ({ organization, errors, onFetchMoreIssues }) => {
  if (errors) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(' ')}
      </p>
    );
  }
  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
      </p>
      <Repository
        repository={organization.repository}
        onFetchMoreIssues={onFetchMoreIssues}
      />
    </div>
  );
};

const Repository = ({ repository, onFetchMoreIssues }) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>

    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>

          <ul>
            {issue.node.reactions.edges.map(reaction => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>

    <hr />

    {repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
);

export default App;
