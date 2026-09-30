package com.twelveaxes;

import static org.assertj.core.api.Assertions.assertThat;

import com.twelveaxes.service.QuizDataService;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class PersonalityCategoryTest {
    private static final Set<String> CATEGORIAS_VALIDAS = Set.of(
            "politico", "religioso", "economista", "filosofo",
            "teorico", "empresario", "intelectual", "ativista"
    );
    private static final Set<String> REPRESENTACOES_VALIDAS = Set.of("male", "female");

    @Autowired
    private QuizDataService dataService;

    @Test
    void everyPersonalityHasAValidCategory() {
        assertThat(dataService.getPersonalities())
                .isNotEmpty()
                .allSatisfy(personality -> assertThat(personality.category())
                        .as("Personalidade %s precisa de categoria valida", personality.id())
                        .isIn(CATEGORIAS_VALIDAS));
    }

    @Test
    void everyPersonalityHasAValidRepresentation() {
        assertThat(dataService.getPersonalities())
                .isNotEmpty()
                .allSatisfy(personality -> assertThat(personality.representation())
                        .as("Personalidade %s precisa de representation valida", personality.id())
                        .isIn(REPRESENTACOES_VALIDAS));
    }


    @Test
    void catalogContainsFemalePersonalitiesAndLocalPortraits() {
        var women = dataService.getPersonalities().stream()
                .filter(personality -> "female".equals(personality.representation()))
                .toList();

        assertThat(women)
                .as("O catalogo precisa manter representacao feminina")
                .isNotEmpty()
                .allSatisfy(personality -> assertThat(personality.imagePath())
                        .as("Personalidade feminina %s precisa de retrato", personality.id())
                        .isNotBlank());
    }

    @Test
    void everyCategoryHasAtLeastOnePersonality() {
        var usadas = dataService.getPersonalities().stream()
                .map(personality -> personality.category())
                .distinct()
                .toList();

        assertThat(usadas).containsExactlyInAnyOrderElementsOf(CATEGORIAS_VALIDAS);
    }

    // O catalogo EN traduz nome, papel e descricao, mas a categoria e a mesma:
    // ela classifica a figura historica, nao o texto exibido.
    @Test
    void englishCatalogKeepsTheSameCategories() {
        var pt = dataService.getPersonalities(QuizDataService.LANG_PT);
        var en = dataService.getPersonalities(QuizDataService.LANG_EN);

        assertThat(en).hasSameSizeAs(pt);
        assertThat(en).allSatisfy(personality -> {
            assertThat(personality.category())
                    .as("Personalidade %s precisa de categoria no catalogo EN", personality.id())
                    .isIn(CATEGORIAS_VALIDAS);
            assertThat(personality.representation())
                    .as("Personalidade %s precisa de representation no catalogo EN", personality.id())
                    .isIn(REPRESENTACOES_VALIDAS);
        });
    }
}
