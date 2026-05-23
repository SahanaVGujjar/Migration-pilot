import React from 'react';
import PropTypes from 'prop-types';

class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isMenuOpen: false,
      searchQuery: '',
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyPress);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyPress);
  }

  handleKeyPress = (event) => {
    if (event.key === 'Escape') {
      this.setState({ isMenuOpen: false });
    }
  };

  toggleMenu = () => {
    this.setState({ isMenuOpen: !this.state.isMenuOpen });
  };

  handleSearch = (event) => {
    this.setState({ searchQuery: event.target.value });
    if (this.props.onSearch) {
      this.props.onSearch(event.target.value);
    }
  };

  render() {
    return (
      <header className="header">
        <h1>{this.props.title}</h1>
        <input
          type="text"
          value={this.state.searchQuery}
          onChange={this.handleSearch}
          placeholder="Search..."
        />
        <button onClick={this.toggleMenu}>
          {this.state.isMenuOpen ? 'Close' : 'Menu'}
        </button>
        {this.state.isMenuOpen && (
          <nav className="menu">
            {this.props.menuItems.map((item, index) => (
              <a key={index} href={item.url}>
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>
    );
  }
}

Header.propTypes = {
  title: PropTypes.string.isRequired,
  menuItems: PropTypes.array.isRequired,
  onSearch: PropTypes.func,
};

export default Header;
