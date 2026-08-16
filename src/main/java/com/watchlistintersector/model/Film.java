package com.watchlistintersector.model;

/**
 * A film as it appears on a Letterboxd watchlist. The slug is the stable
 * identifier used for matching between two users' watchlists. Year is null
 * when it couldn't be parsed out of the title (e.g. a fallback title with no
 * year in it).
 */
public record Film(String slug, String title, Integer year) {
}
