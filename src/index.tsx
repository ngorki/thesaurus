import { ActionPanel, Action, List, showToast, Toast, MenuBarExtra } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search Thesaurus"
      throttle
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {state.results.map((searchResult) => (
          <SearchListItem key={searchResult.word} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

//TODO: Render a list of search results

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.word}
      subtitle={searchResult.label}
      // accessoryTitle={searchResult.thesaurus}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {/* <Action.OpenInBrowser title="Open in Browser" url={searchResult.url} /> */}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Word"
              content={`${searchResult.word}`}
              shortcut={{ modifiers: ["cmd"], key: "." }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(searchText, cancelRef.current.signal);
        setState((oldState) => ({
          ...oldState,
          results: results,
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<SearchResult[]> {
  // const params = new URLSearchParams();
  // params.append("key", "ad52d309-3b5d-4ca9-b51b-e987978f6712");
  if(searchText === "") {
    return [];
  }

  let returnData: SearchResult[] = [];

  await fetch("https://www.dictionaryapi.com/api/v3/references/thesaurus/json/" + searchText + "?key=ad52d309-3b5d-4ca9-b51b-e987978f6712", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    // signal: signal,
  }).then((response) => (response.json())).then((data: any) => {
    for(let i = 0; i < data.length; i++) {
      if(data[i].meta.id === searchText) {
        let definitionObj: SearchResult = {
          word: data[i].meta.id,
          label: data[i].fl,
          thesaurus: [],
        };
        let thesaurus = [];
        for(let j = 0; j < data[i].shortdef.length; j++) {
            thesaurus.push({
              definition: data[i].shortdef[j] as string,
              synonyms: data[i].meta.syns[j] as string[],
              antonyms: data[i].meta.ants[j] as string[],
            });
        }
        definitionObj.thesaurus = thesaurus;
        returnData.push(definitionObj);
      } else{
        break;
      }
    }

  }, (error) => {throw new Error(error.message)});

  return returnData;
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
}

interface SearchResult {
  word: string;
  label: string;
  thesaurus: ThesaurusIndex[];
}

interface ThesaurusIndex {
  definition: string;
  synonyms: string[];
  antonyms: string[];
}
