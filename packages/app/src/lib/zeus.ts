import type { LoadEvent } from "@sveltejs/kit";
import {
  GraphQLError,
  Selector,
  Thunder,
  ZeusScalars,
  type GraphQLResponse,
  type GraphQLTypes,
  type InputType,
  type ValueTypes,
} from "../zeus/index.js";
// @ts-expect-error Not typed
import extractFiles from "extract-files/extractFiles.mjs";
// @ts-expect-error Not typed
import isFile from "extract-files/isExtractableFile.mjs";

export * from "../zeus/index.js";

export type PropsType<
  T extends (...args: never[]) => unknown,
  U extends keyof GraphQLTypes = "Query"
> = InputType<GraphQLTypes[U], ReturnType<T>>;

export interface Options {
  token?: string;
}

const chain = (fetch: LoadEvent["fetch"], { token }: Options) => {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return Thunder(async (query, variables) => {
    let body: BodyInit;
    const { clone, files } = extractFiles(variables, isFile, "variables");

    // If the payload contains files, send as multipart/form-data
    if (files.size > 0) {
      body = new FormData();
      body.append("operations", JSON.stringify({ query, variables: clone }));
      body.append("map", JSON.stringify([...files.values()]));
      for (const [i, [file]] of [...files].entries()) body.append(`${i}`, file);
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify({ query, variables });
    }

    const response: GraphQLResponse = await fetch(
      "http://localhost:4000/graphql",
      { body, method: "POST", headers }
    ).then((response) => response.json());

    if (response.errors) throw new GraphQLError(response);
    return response.data;
  });
};

const scalars = ZeusScalars({
  DateTime: {
    decode: (value: unknown): Date | null =>
      (value as null) && new Date(value as string),
    encode: (value: unknown): string =>
      (value as string) && (value as Date).toISOString(),
  },
});

export const Query = Selector("Query");

export const query = <Operation extends ValueTypes["Query"]>(
  fetch: LoadEvent["fetch"],
  op: Operation,
  options: Options = {}
) =>
  chain(fetch, options)("query", { scalars })(op) as Promise<
    InputType<GraphQLTypes["Query"], Operation, typeof scalars>
  >;

export const mutate = <Operation extends ValueTypes["Mutation"]>(
  op: Operation,
  options: Options & { variables?: Record<string, unknown> } = {}
) =>
  chain(fetch, options)("mutation", { scalars })(op, {
    variables: options.variables ?? {},
  }) as Promise<InputType<GraphQLTypes["Mutation"], Operation, typeof scalars>>;
