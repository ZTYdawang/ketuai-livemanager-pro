# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy the rest of the application's source code
COPY . .

# Make port 5001 available to the world outside this container
EXPOSE 5001

# Run the app when the container launches
CMD ["npm", "run", "dev"] 