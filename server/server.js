const { ApolloServer } = require("apollo-server");
const { PubSub } = require("apollo-server");

const pubSub = new PubSub();

const { gql } = require("apollo-server");

const messages = [];
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
      const newMessage = [
        {
          id,
          user,
          content,
        },
      ];
      messages.push(newMessage);
      pubSub.publish(NEW_MESSAGE, { newMessages: newMessage });
      return id;
    },
  },
  Subscription: {
    newMessages: {
      subscribe: () => pubSub.asyncIterator([NEW_MESSAGE]),
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
