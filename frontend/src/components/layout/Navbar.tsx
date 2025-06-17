import React from 'react';

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'flagReview', label: 'Flag Review' },
    { id: 'management', label: 'Management' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <header className="bg-surface border-b border-[#2A2C32]">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-accent-teal font-bold text-xl mr-10">CREDIT COMPLIANCE TOOL</h1>
          <nav className="hidden md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`px-4 py-2 mx-1 rounded-md transition-colors duration-200 text-sm font-medium ${ // Adjusted size/weight
                  currentPage === item.id
                    ? 'text-accent-teal border-b-2 border-accent-teal'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setCurrentPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center">
          <div className="relative">
            <button className="flex items-center text-text-primary hover:text-accent-teal">
              <span className="mr-2 text-sm">User</span> {/* Adjusted size */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {/* Add dropdown menu logic here if needed */}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
