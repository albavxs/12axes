package com.twelveaxes.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Busca gerada: fica neste pacote para alcancar os metodos package-private de
 * BookRecommendationService.
 */
class BookRecommendationServiceSearchTest {

    @Test
    void searchUsesOnlyTheFirstCreditedAuthor() {
        // A linha de credito completa virava uma frase longa na busca gerada e a
        // Amazon respondia "Nenhum resultado" -- era o caso de Vilma Espin.
        assertThat(BookRecommendationService.searchAuthor(
                "Vilma Espín, Asela de los Santos, Yolanda Ferrer"))
                .isEqualTo("Vilma Espín");
        assertThat(BookRecommendationService.searchAuthor("Vilma Espín & Asela"))
                .isEqualTo("Vilma Espín");
        assertThat(BookRecommendationService.searchAuthor("Fernando Morais"))
                .isEqualTo("Fernando Morais");
        assertThat(BookRecommendationService.searchAuthor(null)).isEmpty();
        assertThat(BookRecommendationService.searchAuthor("  ")).isEmpty();
    }

    @Test
    void generatedSearchCarriesOnlyTheFirstAuthor() {
        String url = BookRecommendationService.affiliateUrl(
                "", "Women in Cuba", "Vilma Espín, Asela de los Santos", "pt");

        assertThat(url).contains("Vilma+Esp%C3%ADn").doesNotContain("Asela");
    }

    @Test
    void storedUrlWinsOverTheGeneratedSearch() {
        String stored = "https://www.amazon.com.br/dp/1604880368?tag=12axes-20";

        assertThat(BookRecommendationService.affiliateUrl(stored, "qualquer", "qualquer", "pt"))
                .isEqualTo(stored);
    }
}
