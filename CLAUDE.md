# Kelly Criterion Portfolio Allocation Project Guidelines

## Commands
- **Start Server**: `npm run start-server`
- **Start Frontend**: `npm start`
- **Update Data**: `npm run update-data`
- **Run All Tests**: `npm test`
- **Run Single Test**: `npm test -- -t "testNamePattern"`
- **Run Specific Test File**: `npm run test:utils`

## Code Style Guidelines
- **Imports**: Group imports by source (Node.js built-ins first, then external packages, then local modules)
- **Formatting**: Use 2-space indentation
- **Documentation**: JSDoc comments for all functions with param/return types
- **Error Handling**: Use try/catch with specific error messages; log errors before throwing
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Variables**: Prefer const over let; avoid var
- **Financial Calculations**: Document assumptions and constraints for financial formulas
- **Performance**: Be mindful of computational complexity for matrix operations
- **Testing**: Test edge cases, especially for financial calculations
- **File Structure**: Separate utility functions (utils.js) from business logic

Run `node server.js` to start the API server.