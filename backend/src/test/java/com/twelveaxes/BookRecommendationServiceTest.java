package com.twelveaxes;

import static org.assertj.core.api.Assertions.assertThat;

import com.twelveaxes.model.PersonalityMatch;
import com.twelveaxes.service.BookRecommendationService;
import com.twelveaxes.service.QuizDataService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class BookRecommendationServiceTest {

    @Autowired
    private BookRecommendationService service;

    @Autowired
    private QuizDataService dataService;

    @Test
    void skipsUnavailableBooksAndBackfillsFromLowerRankedMatches() {
        String availableId = dataService.getBooks().keySet().stream().findFirst().orElseThrow();
        var ranked = List.of(
                match("personality-without-book", 99),
                match(availableId, 98)
        );

        var recommendations = service.recommend(ranked, QuizDataService.LANG_PT);

        assertThat(recommendations)
                .hasSize(1)
                .allSatisfy(book -> assertThat(book.personalityId()).isEqualTo(availableId));
    }

    @Test
    void keepsSearchingUntilThreeAvailableBooksAreFound() {
        var availableIds = dataService.getBooks().keySet().stream().limit(4).toList();
        assertThat(availableIds).hasSizeGreaterThanOrEqualTo(3);

        var ranked = List.of(
                match("missing-book-1", 100),
                match(availableIds.get(0), 99),
                match("missing-book-2", 98),
                match(availableIds.get(1), 97),
                match("missing-book-3", 96),
                match(availableIds.get(2), 95),
                match(availableIds.get(3), 94)
        );

        var recommendations = service.recommend(ranked, QuizDataService.LANG_PT);

        assertThat(recommendations)
                .extracting(book -> book.personalityId())
                .containsExactly(availableIds.get(0), availableIds.get(1), availableIds.get(2));
    }

    @Test
    void biographyKeepsTheRealBookAuthorSeparateFromThePersonality() {
        var recommendations = service.recommend(
                List.of(match("olga-benario", 99)),
                QuizDataService.LANG_PT
        );

        assertThat(recommendations).hasSize(1);
        var book = recommendations.getFirst();
        assertThat(book.author()).isEqualTo("Fernando Morais");
        assertThat(book.associationType()).isEqualTo("biography");
    }

    @Test
    void usesTheStoredProductUrlWhenThereIsOne() {
        var book = service.recommend(
                List.of(match("olga-benario", 99)),
                QuizDataService.LANG_PT
        ).getFirst();

        // URL verificada vence a busca gerada: leva direto ao produto.
        assertThat(book.url()).contains("/dp/").doesNotContain("/s?k=");
    }

    @Test
    void fallsBackToAGeneratedSearchWhenNoUrlIsStored() {
        String withoutUrl = dataService.getBooks().entrySet().stream()
                .filter(entry -> {
                    var url = entry.getValue().url();
                    return url == null || url.get("pt") == null || url.get("pt").isBlank();
                })
                .map(Map.Entry::getKey)
                .findFirst()
                .orElseThrow();

        var book = service.recommend(
                List.of(match(withoutUrl, 99)),
                QuizDataService.LANG_PT
        ).getFirst();

        assertThat(book.url()).contains("/s?k=").contains("tag=12axes-20");
    }

    @Test
    void neverReturnsMoreThanThreeBooks() {
        var availableIds = dataService.getBooks().keySet().stream().limit(4).toList();
        assertThat(availableIds).hasSize(4);

        var ranked = List.of(
                match(availableIds.get(0), 100),
                match(availableIds.get(1), 99),
                match(availableIds.get(2), 98),
                match(availableIds.get(3), 97)
        );

        assertThat(service.recommend(ranked, QuizDataService.LANG_PT)).hasSize(3);
    }

    @Test
    void multiAuthorCreditIsKeptForDisplay() {
        var recommendations = service.recommend(
                List.of(match("vilma-espin", 99)),
                QuizDataService.LANG_PT
        );

        assertThat(recommendations).hasSize(1);
        // O credito completo continua visivel para o leitor; o recorte para a
        // busca gerada e coberto por BookRecommendationServiceSearchTest.
        assertThat(recommendations.getFirst().author()).contains("Asela de los Santos");
    }

    @Test
    void deliversTheEditionThatExistsWhenThereIsNoPortugueseOne() {
        // Nao existe edicao em portugues de Women in Cuba, so a inglesa da
        // Pathfinder e a espanhola. O leitor pt recebe a que da para comprar.
        var book = dataService.getBooks().get("vilma-espin");
        assertThat(book.title().get("pt")).isEqualTo(book.title().get("en"));
    }

    private PersonalityMatch match(String id, double compatibility) {
        return new PersonalityMatch(
                id,
                id,
                "",
                "ativista",
                "female",
                "",
                "",
                "",
                "",
                "",
                "",
                compatibility,
                0,
                Map.of()
        );
    }
}
