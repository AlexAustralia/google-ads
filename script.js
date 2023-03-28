/**
 * Bid to Impression Share script.
 *
 * This script changes keyword bids so that they target specified positions,
 * based on recent performance.
 *
 * Version 2.1
 */

// SCRIPT PARAMETERS SECTION START
// Use Absolute Top instead of Top
const USE_ABSOLUTE_TOP = true;

// Ad impression share we are trying to achieve, represented as a percentage.
const TARGET_IMPRESSION_SHARE = 0.8;

// Once the keywords fall within TOLERANCE of TARGET_IMPRESSION_SHARE,
// their bids will no longer be adjusted. Represented as a percentage.
const TOLERANCE = 0.05;

// How much to adjust the bids.
const BID_ADJUSTMENT_COEFFICIENT = 1.05;

// Number of days for getting statistics.
// Recommended to use 7 or greater value.
const NUMBER_OF_DAYS_FOR_STATISTICS = 7;

// Do not change bid if a keyword had 0 impressions for the NUMBER_OF_DAYS_FOR_STATISTICS period.
const DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS = true;

// Bids will not be increased past this maximum.
const MAX_BID = 35.00;

// Bids will not be decreased below this minimum.
const MIN_BID = 5.15;

// Should new bids be equal to or greater than Google first page CPC or top of page CPC (if absolute impression is used)
const USE_GOOGLE_FIRST_PAGE_OR_TOP_OF_PAGE_CPC = false;
// SCRIPT PARAMETERS SECTION END

// Global variables for getting statistical data.
let start = '';
let finish = '';

/**
 * Main function that lowers and raises keywords' CPC to move closer to
 * target impression share.
 */
function main() {
    getDateRange();
    raiseKeywordBids();
    lowerKeywordBids();
}

/**
 * Get Date Range object to be used for getting statistics and set them into global variables.
 */
function getDateRange() {
    let date = new Date();
    finish = formatDate(date);
    date.setDate(date.getDate() - NUMBER_OF_DAYS_FOR_STATISTICS + 1);
    start = formatDate(date);
}

/**
 * Format date.
 * @param {Date} date - date to be formatted.
 * @returns {string} - formatted date.
 */
function formatDate(date) {
    return Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), 'YYYYMMdd');
}

/**
 * Get Keyword's impressions.
 * @param {AdsApp.Keyword} keyword - Keyword to get impression of.
 * @returns {number} - keyword's impression number.
 */
function getImpressions(keyword) {
    return keyword.getStatsFor(start, finish).getImpressions();
}

/**
 * Increases the CPC of keywords that are below the target impression share.
 * Change bid for non-zero impressions keywords only if DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS is set to true.
 */
function raiseKeywordBids() {
    const keywordsToRaise = getKeywordsToRaise();
    for (const keyword of keywordsToRaise) {
        if ((DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS && getImpressions(keyword) > 0) || !DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS) {
            keyword.bidding().setCpc(getIncreasedCpc(keyword.bidding().getCpc(), keyword.getFirstPageCpc(), keyword.getTopOfPageCpc()));
        }
    }
}

/**
 * Decreases the CPC of keywords that are above the target impression share.
 * Change bid for non-zero impressions keywords only if DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS is set to true.
 */
function lowerKeywordBids() {
    const keywordsToLower = getKeywordsToLower();
    for (const keyword of keywordsToLower) {
        if ((DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS && getImpressions(keyword) > 0) || !DO_NOT_CHANGE_BID_IF_NO_IMPRESSIONS) {
            keyword.bidding().setCpc(getDecreasedCpc(keyword.bidding().getCpc()));
        }
    }
}

/**
 * Increases a given CPC using the bid adjustment coefficient.
 * If USE_GOOGLE_FIRST_PAGE_OR_TOP_OF_PAGE_CPC is true, then the new bid must be equal to or higher than the first page CPC
 * or the top of page CPC (if absolute impression is used).
 * The final CPC must be within MIN_BID and MAX_BID range.
 * @param {number} cpc - the CPC to increase
 * @param {number} firstPageCpc - first page CPC
 * @param {number} topOfPageCpc - top of Page CPC
 * @return {number} - the new CPC
 */
 function getIncreasedCpc(cpc, firstPageCpc, topOfPageCpc) {
     let newCpc = cpc * BID_ADJUSTMENT_COEFFICIENT;
     if (USE_GOOGLE_FIRST_PAGE_OR_TOP_OF_PAGE_CPC) {
         const minCpc = USE_ABSOLUTE_TOP ? topOfPageCpc : firstPageCpc;
         if (newCpc < minCpc) {
             newCpc = minCpc;
         }
     }
     return limitCpc(newCpc);
}

/**
 * Decreases a given CPC using the bid adjustment coefficient.
 * @param {number} cpc - the CPC to decrease
 * @return {number} - the new CPC
 */
function getDecreasedCpc(cpc) {
    let newCpc = cpc / BID_ADJUSTMENT_COEFFICIENT;
    return limitCpc(newCpc);
}

/**
 * Limit CPC within MIN_BID and MAX_BID range.
 * @param {number} cpc - CPC to be limited
 * @returns {number} - limited CPC
 */
function limitCpc(cpc) {
    if (cpc > MAX_BID) {
        cpc = MAX_BID;
    }
    if (cpc < MIN_BID) {
        cpc = MIN_BID;
    }
    return cpc;
}

/**
 * Gets an iterator of the keywords that need to have their CPC raised.
 * @return {!Iterator} - an iterator of the keywords
 */
function getKeywordsToRaise() {
    // Condition to raise bid: Average impression share is worse (less) than
    // target - tolerance
    if (USE_ABSOLUTE_TOP) {
        return AdsApp.keywords()
            .withCondition(`ad_group_criterion.status = ENABLED`)
            .withCondition(
                `metrics.search_absolute_top_impression_share < ${TARGET_IMPRESSION_SHARE - TOLERANCE}`)
            .orderBy(`metrics.search_absolute_top_impression_share ASC`)
            .forDateRange(start, finish)
            .get();
    } else {
        return AdsApp.keywords()
            .withCondition(`ad_group_criterion.status = ENABLED`)
            .withCondition(
                `metrics.search_impression_share < ${TARGET_IMPRESSION_SHARE - TOLERANCE}`)
            .orderBy(`metrics.search_impression_share ASC`)
            .forDateRange(start, finish)
            .get();
    }
}

/**
 * Gets an iterator of the keywords that need to have their CPC lowered.
 * @return {!Iterator} - an iterator of the keywords
 */
function getKeywordsToLower() {
    // Conditions to lower bid: average impression share better (greater) than target + tolerance
    if (USE_ABSOLUTE_TOP) {
        return AdsApp.keywords()
            .withCondition(
                `metrics.search_absolute_top_impression_share > ${TARGET_IMPRESSION_SHARE + TOLERANCE}`)
            .withCondition(`ad_group_criterion.status = ENABLED`)
            .orderBy(`metrics.search_absolute_top_impression_share DESC`)
            .forDateRange(start, finish)
            .get();
    } else {
        return AdsApp.keywords()
            .withCondition(
                `metrics.search_impression_share > ${TARGET_IMPRESSION_SHARE + TOLERANCE}`)
            .withCondition(`ad_group_criterion.status = ENABLED`)
            .orderBy(`metrics.search_impression_share DESC`)
            .forDateRange(start, finish)
            .get();
    }
}
