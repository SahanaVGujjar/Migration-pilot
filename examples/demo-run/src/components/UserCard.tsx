interface UserCardProps {
  user: Record<string, any>;
  onDelete?: (...args: any[]) => any;
}

import React from 'react';
import { capitalize } from '../utils/format';

class UserCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isExpanded: false,
      loading: false,
    };
  }

  toggleExpand = () => {
    this.setState({ isExpanded: !this.state.isExpanded });
  };

  handleDelete = () => {
    this.setState({ loading: true });
    if (this.props.onDelete) {
      this.props.onDelete(this.props.user.id);
    }
  };

  render() {
    const { user } = this.props;
    const { isExpanded, loading } = this.state;

    return (
      <div className={`user-card ${isExpanded ? 'expanded' : ''}`}>
        <div className="user-card-header" onClick={this.toggleExpand}>
          <h3>{capitalize(user.name)}</h3>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </div>
        {isExpanded && (
          <div className="user-card-body">
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
            <button onClick={this.handleDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    );
  }
}

;

export default UserCard;
