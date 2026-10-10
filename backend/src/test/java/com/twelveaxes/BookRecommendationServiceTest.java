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
    void biographyKeepsTheRealBookAuthorAndUsesItInTheAffiliateSearch() {
        var recommendations = service.recommend(
                List.of(match("olga-benario", 99)),
                QuizDataService.LANG_PT
        );

        assertThat(recommendations).hasSize(1);
        var book = recommendations.getFirst();
        assertThat(book.author()).isEqualTo("Fernando Morais");
        assertThat(book.associationType()).isEqualTo("biography");
        assertThat(book.url()).contains("Fernando+Morais");
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
    void multiAuthorCreditIsKeptForDisplayButTrimmedInTheSearch() {
        var recommendations = service.recommend(
                List.of(match("vilma-espin", 99)),
                QuizDataService.LANG_PT
        );

        assertThat(recommendations).hasSize(1);
        var book = recommendations.getFirst();
        // O credito completo continua visivel para o leitor.
        assertThat(book.author()).contains("Asela de los Santos");
        // A busca leva so a primeira autora.
        assertThat(book.url()).contains("Vilma+Esp%C3%ADn").doesNotContain("Asela");
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
