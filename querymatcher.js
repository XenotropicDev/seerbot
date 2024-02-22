import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Fuse from "fuse.js";
import path from 'path';

export const QueryCode = {
    RULINGS: '?',
};

/**
 * Matches cards info queries of the form {{card name}}, as well as handling
 * various query codes appended to the front of the intended card name.
 */
export class QueryMatcher {

    #fuzzySearch = new FuzzyCardSearch();

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

        // match on the pattern {{SOMETEXT}}
        const matches = discordMsg.content.match(/\{\{(.*?)\}\}/g);
        const cardQueries = [];
    
        if (matches) {
            matches.forEach((match) => {
                let query = match.replace('{{', '').replace('}}', '').trim();
                let queryCode = undefined;

                if (query === '') {
                    // if query is {{}} ignore it entirely
                    return;
                } else if (query.startsWith(QueryCode.RULINGS)) {
                    query = query.substring(1, query.length).trim();
                    queryCode = QueryCode.RULINGS;
                }

                const cardName = this.#fuzzySearch.search(query);
                cardQueries.push({ queryCode: queryCode, query: query, cardName: cardName })
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

    #cardFile = 'card_list.txt';
    #fuse;

    constructor() {
        this.#initialize();
    }

    async #initialize() {
        const filePath = path.join(dirname(fileURLToPath(import.meta.url)), this.#cardFile);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        this.#fuse = new Fuse(data.split(/\r?\n/), { threshold: 0.3 });
    }

    search(searchPattern) {
        const result = this.#fuse.search(searchPattern);
        return result.length > 0 ? result[0].item : undefined;
    }
}