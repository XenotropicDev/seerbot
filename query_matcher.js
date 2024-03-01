import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Fuse from "fuse.js";
import path from 'path';
import { CLOSE_QUERY, OPEN_QUERY } from './embeds.js';

export const QueryCode = Object.freeze({
    RULINGS: '?',
    IMAGE: '!',
    PRICE: '$',
});

const QUERY_CODES = Object.values(QueryCode);

/**
 * Matches card info queries of the form ((card name)), as well as handling
 * various query codes appended to the front or end of the intended card name.
 */
export class QueryMatcher {

    #fuzzySearch;

    constructor(cardFile) {
        this.#fuzzySearch = new FuzzyCardSearch(cardFile);
    }

    /**
     * Gets a list of query matches within the given Discord message.
     * Matches include a queryCode, representing a special character for 
     * a specific function (such as ? for card rulings), the query itself,
     * and the cardName matching the query (or undefined if there is no match).
     * 
     * @param {string} discordMsg the full text of the incoming Discord message
     * @returns An array of matches, in the form [{ queryCode, query, cardName }]
     */
    getMatches(discordMsg) {

        // match on the pattern ((SOME TEXT)) or {{SOME TEXT}}
        // TODO (()) is far better as a mobile experience so eventually
        // we'd like to get rid of {{}} altogether
        const matches = discordMsg.content.match(/\(\((.*?)\)\)|\{\{(.*?)\}\}/g);

        const cardQueries = [];
    
        if (matches) {
            matches.forEach((match) => {
                let query = match
                    .replace(OPEN_QUERY, '')
                    .replace(CLOSE_QUERY, '')
                    .replace('{{', '') // TODO remove these once folks start using (())
                    .replace('}}', '')
                    .trim();
                let queryCode = undefined;
                let setCode = undefined;

                if (query === '') {
                    // if query is (()) ignore it entirely
                    return;
                } else if (QUERY_CODES.includes(query.substring(0, 1))) {
                    // handle if the query starts with a query code
                    queryCode = query.substring(0, 1);
                    query = query.substring(1, query.length).trim();
                }

                if (query.includes('|') && query.indexOf('|') !== query.length - 1) {
                    // handle if the query contains the | along with a potential set code at the end
                    setCode = query.substring(query.indexOf('|') + 1, query.length).trim();
                    query = query.substring(0, query.indexOf('|')).trim();
                }

                const cardName = this.#fuzzySearch.search(query);
                cardQueries.push({ queryCode: queryCode, query: query, cardName: cardName, setCode: setCode, brackets: match.trim().startsWith('{{') })
            });
        }
    
        return cardQueries;
    }
}

/**
 * A fuzzy search implementation, which allows users to have 
 * minor misspellings and still get a result.
 */
class FuzzyCardSearch {

    #fuse;

    constructor(searchFile) {
        this.#initialize(searchFile);
    }

    async #initialize(searchFile) {
        const filePath = path.join(dirname(fileURLToPath(import.meta.url)), searchFile);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        this.#fuse = new Fuse(data.split(/\r?\n/), { threshold: 0.3 });
    }

    search(searchPattern) {
        const result = this.#fuse.search(searchPattern);
        return result.length > 0 ? result[0].item : undefined;
    }
}