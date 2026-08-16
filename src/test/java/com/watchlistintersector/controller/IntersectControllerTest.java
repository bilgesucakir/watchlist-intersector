package com.watchlistintersector.controller;

import com.watchlistintersector.model.Film;
import com.watchlistintersector.service.LetterboxdScraperService;
import com.watchlistintersector.service.WatchlistResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IntersectController.class)
class IntersectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LetterboxdScraperService scraperService;

    @Test
    void returnsOnlyFilmsPresentOnBothWatchlists() throws Exception {
        when(scraperService.fetchWatchlist(eq("alice"))).thenReturn(WatchlistResult.of("alice", Set.of(
                new Film("dune-part-two", "Dune: Part Two"),
                new Film("anora", "Anora"))));
        when(scraperService.fetchWatchlist(eq("bob"))).thenReturn(WatchlistResult.of("bob", Set.of(
                new Film("dune-part-two", "Dune: Part Two"),
                new Film("the-substance", "The Substance"))));

        mockMvc.perform(get("/api/intersect").param("user1", "alice").param("user2", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Dune: Part Two"))
                .andExpect(jsonPath("$[0].url").value("https://letterboxd.com/film/dune-part-two/"));
    }

    @Test
    void returnsEmptyListWhenNoFilmsInCommon() throws Exception {
        when(scraperService.fetchWatchlist(eq("alice"))).thenReturn(WatchlistResult.of("alice", Set.of(
                new Film("dune-part-two", "Dune: Part Two"))));
        when(scraperService.fetchWatchlist(eq("bob"))).thenReturn(WatchlistResult.of("bob", Set.of(
                new Film("anora", "Anora"))));

        mockMvc.perform(get("/api/intersect").param("user1", "alice").param("user2", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void returns400NamingInaccessibleUser() throws Exception {
        when(scraperService.fetchWatchlist(eq("alice"))).thenReturn(WatchlistResult.inaccessible("alice"));
        when(scraperService.fetchWatchlist(eq("bob"))).thenReturn(WatchlistResult.of("bob", Set.of(
                new Film("anora", "Anora"))));

        mockMvc.perform(get("/api/intersect").param("user1", "alice").param("user2", "bob"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("alice")))
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("bob"))));
    }

    @Test
    void returns400NamingBothUsersWhenBothInaccessible() throws Exception {
        when(scraperService.fetchWatchlist(eq("alice"))).thenReturn(WatchlistResult.inaccessible("alice"));
        when(scraperService.fetchWatchlist(eq("bob"))).thenReturn(WatchlistResult.inaccessible("bob"));

        mockMvc.perform(get("/api/intersect").param("user1", "alice").param("user2", "bob"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("alice"),
                        org.hamcrest.Matchers.containsString("bob"))));
    }

    @Test
    void returns400WhenUsernameIsBlank() throws Exception {
        mockMvc.perform(get("/api/intersect").param("user1", " ").param("user2", "bob"))
                .andExpect(status().isBadRequest());
    }
}
