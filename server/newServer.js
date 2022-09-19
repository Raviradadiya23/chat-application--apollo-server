const { ApolloServer } = require("apollo-server-express");
const { createServer } = require("http");
const express = require("express");
const {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault,
} = require("apollo-server-core");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { gql } = require("apollo-server");
const { PubSub } = require("graphql-subscriptions");

const messages = [];

async function setupServer() {
  const pubSub = new PubSub();

  const NEW_MESSAGE = "NEW_MESSAGE";

  const typeDefs = gql`
    type Message {
      id: ID!
      user: String!
      content: String!
    }

    type Query {
      messages: [Message!]
    }

    type Mutation {
      postMessage(user: String!, content: String!): ID!
    }

    type Subscription {
      newMessages: [Message!]
    }
  `;

  const resolvers = {
    Query: {
      messages: () => messages,
    },
    Mutation: {
      postMessage: (parent, { user, content }) => {
        const id = messages.length;
        const newMessage = {
          id,
          user,
          content,
        };
        messages.push(newMessage);
        pubSub.publish(NEW_MESSAGE, { newMessages: messages });
        return id;
      },
    },
    Subscription: {
      newMessages: {
        subscribe: () => pubSub.asyncIterator([NEW_MESSAGE]),
      },
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create an Express app and HTTP server; we will attach the WebSocket
  // server and the ApolloServer to this HTTP server.
  const app = express();
  const httpServer = createServer(app);

  // Set up WebSocket server.
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  // Set up ApolloServer.
  const server = new ApolloServer({
    schema,
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await server.start();
  server.applyMiddleware({ app });

  // Now that our HTTP server is fully set up, actually listen.
  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(
      `🚀 Query endpoint ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    console.log(
      `🚀 Subscription endpoint ready at ws://localhost:${PORT}${server.graphqlPath}`
    );
  });
}

setupServer();
