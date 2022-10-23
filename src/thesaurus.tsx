import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";
import { v4 } from "uuid";

function getSynonymsOrAntonyms(searchResult: SearchResult, type: string) {
    if(searchResult == null){
        return null
    }
    if(type === 's' || type === 'synonyms'){
      return searchResult.thesaurus.map((result) => (
        result.synonyms?.map((synonym) => (
          <SearchListWord key={v4()} searchResult={synonym}/>
        ))
      ))
    } else if (type === 'a' || type === 'antonyms'){
      return searchResult.thesaurus.map((result) => (
        result.antonyms?.map((antonym) => (
          <SearchListWord key={v4()} searchResult={antonym}/>
        ))
      ))
    } else if (type === 'b' || type === 'both'){
      const thesaurus = searchResult.thesaurus.map((result) => (
        result.synonyms.slice().concat(result.antonyms)
      ))
      return thesaurus.map((result) => (
        result.map((word) => (
          <SearchListWord key={v4()} searchResult={word}/>
        ))))
    }
  
  }
  
export default function Command(type: string) {
    const { state, search } = useSearch();
  
    return (
      <List
        isLoading={state.isLoading}
        onSearchTextChange={search}
        searchBarPlaceholder={"Search " + (type === 's' ? 'Synonyms' : type === 'a' ? 'Antonyms' : 'Thesaurus') + "..."}
        throttle
      >
          {state.results.map((searchResult) => (
            <>
              {/* <SearchListItem key={searchResult.label} searchResult={searchResult} /> */}
              <List.Section title={searchResult.word} subtitle={searchResult.label}>
                {getSynonymsOrAntonyms(searchResult, type)}
              </List.Section>
            </>
          ))}
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
  
  function SearchListWord({ searchResult }: { searchResult: string }) {
    return (
      <List.Item
        title={searchResult}
        // accessoryTitle={searchResult.thesaurus}
        actions={
          <ActionPanel>
            <ActionPanel.Section>
              {/* <Action.OpenInBrowser title="Open in Browser" url={searchResult.url} /> */}
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.CopyToClipboard
                title="Copy Word"
                content={`${searchResult}`}
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
  
    const returnData: SearchResult[] = [];
  
    await fetch("https://www.dictionaryapi.com/api/v3/references/thesaurus/json/" + searchText + "?key=" + process.env.API, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // signal: signal,
    }).then((response) => (response.json())).then((data: any) => {
      for(let i = 0; i < data.length; i++) {
        if(data[i].meta.id === searchText) {
          const definitionObj: SearchResult = {
            word: data[i].meta.id,
            label: data[i].fl,
            thesaurus: [],
          };
          const thesaurus = [];
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
  