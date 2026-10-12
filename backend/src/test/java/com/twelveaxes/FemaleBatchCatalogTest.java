package com.twelveaxes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.twelveaxes.model.Personality;
import com.twelveaxes.model.PersonalityProfile;
import com.twelveaxes.model.QuizResult;
import com.twelveaxes.service.ProfileMatchScorer;
import com.twelveaxes.service.QuizDataService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * O primeiro batch de dez mulheres e o ranking unico em que ele entra.
 *
 * Homens e mulheres sao ranqueados no MESMO pool: nao existe parametro de modo
 * nem catalogo separado. Por isso os testes de dados do batch (as dez existem,
 * tem perfil completo, aparecem no catalogo em ingles) andam junto com os
 * testes de que o ranking considera o catalogo inteiro.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FemaleBatchCatalogTest {
    /** Vetor de eixos proximo do perfil de Ayn Rand, uma das dez do batch. */
    private static final String AYN_RAND_VECTOR = "78,55,6,45,72,28,3,3,6,96,55,92";

    /**
     * Limiar de duplicata bloqueante. Duas pessoas acima dele viram a mesma
     * resposta para o leitor, e uma empurra a outra para fora do ranking.
     */
    private static final double BLOCKING_DUPLICATE_THRESHOLD = 97.0;

    private static final List<String> EXPECTED_FEMALE_IDS = List.of(
            "ayn-rand",
            "hannah-arendt",
            "mary-wollstonecraft",
            "elinor-ostrom",
            "judith-butler",
            "bell-hooks",
            "lelia-gonzalez",
            "nisia-floresta",
            "dorothy-day",
            "condoleezza-rice");

    private static final List<String> AXIS_IDS = List.of(
            "estrutura",
            "representacao",
            "poder",
            "imigracao",
            "diplomacia",
            "intervencao",
            "economia",
            "controle",
            "comercio",
            "religiao",
            "moral",
            "tecnologia");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private QuizDataService dataService;

    @Autowired
    private ProfileMatchScorer profileMatchScorer;

    // ---------------------------------------------------------------- dados

    @Test
    void firstFemaleBatchIsPresentInTheCatalog() {
        assertThat(dataService.getPersonalities())
                .extracting(Personality::id)
                .containsAll(EXPECTED_FEMALE_IDS);
    }

    @Test
    void firstFemaleBatchHasCompleteTwelveAxisProfiles() {
        var profiles = dataService.getPersonalityProfiles();

        for (String id : EXPECTED_FEMALE_IDS) {
            assertThat(profiles)
                    .as("perfil deve existir para %s", id)
                    .containsKey(id);
            assertThat(profiles.get(id).vector())
                    .as("perfil de %s deve conter exatamente os 12 eixos", id)
                    .containsOnlyKeys(AXIS_IDS);
        }
    }

    @Test
    void englishCatalogContainsTheSameFemaleBatch() {
        assertThat(dataService.getPersonalities(QuizDataService.LANG_EN))
                .extracting(Personality::id)
                .containsAll(EXPECTED_FEMALE_IDS);
    }

    /**
     * Com pool unico, a checagem de duplicata tem de valer contra o catalogo
     * INTEIRO, nao so entre as dez. Uma mulher quase identica a um homem passa
     * a ser colisao real: as duas competem pela mesma vaga do ranking e uma
     * esconde a outra.
     */
    @Test
    void femaleBatchHasNoBlockingNearDuplicateInTheWholeCatalog() {
        Map<String, PersonalityProfile> profiles = dataService.getPersonalityProfiles();
        List<Personality> catalog = dataService.getPersonalities();

        for (String femaleId : EXPECTED_FEMALE_IDS) {
            Map<String, Double> femaleVector = profiles.get(femaleId).vector();

            for (Personality other : catalog) {
                if (other.id().equals(femaleId)) {
                    continue;
                }
                PersonalityProfile otherProfile = profiles.get(other.id());
                if (otherProfile == null || otherProfile.vector() == null || otherProfile.vector().isEmpty()) {
                    continue;
                }

                double compatibility =
                        profileMatchScorer.compatibility(femaleVector, otherProfile.vector());

                assertThat(compatibility)
                        .as("%s e %s nao devem cair no limiar bloqueante de duplicata",
                                femaleId, other.id())
                        .isLessThan(BLOCKING_DUPLICATE_THRESHOLD);
            }
        }
    }

    // -------------------------------------------------------- ranking unico

    /**
     * O percentil denuncia o tamanho do pool. Num pool de dez, o topo bate
     * nove e para em 90. Acima de 99 so e possivel comparando contra o
     * catalogo inteiro.
     */
    @Test
    void percentileIsCalculatedOverTheWholeCatalog() throws Exception {
        QuizResult result = resultFor(AYN_RAND_VECTOR);

        assertThat(result.topPersonalityMatch().compatibilityPercentile())
                .as("o topo deve superar quase todo o catalogo, nao so um pool de dez")
                .isGreaterThan(99.0);
    }

    /** Uma mulher ganha o ranking geral, sem nenhum parametro de modo. */
    @Test
    void aWomanCanWinTheSingleRanking() throws Exception {
        QuizResult result = resultFor(AYN_RAND_VECTOR);

        assertThat(result.topPersonalityMatch().personalityId()).isEqualTo("ayn-rand");
        assertThat(result.topPersonalityMatch().compatibility()).isGreaterThanOrEqualTo(99.0);
    }

    /** O mesmo ranking mistura os dois: o topo feminino conviva com homens. */
    @Test
    void menAndWomenShareTheSameRanking() throws Exception {
        QuizResult result = resultFor(AYN_RAND_VECTOR);

        assertThat(result.personalityMatches())
                .extracting(match -> match.personalityId())
                .as("o batch feminino entra no ranking geral")
                .contains("ayn-rand")
                .as("e divide o ranking com quem nao e do batch")
                .anyMatch(id -> !EXPECTED_FEMALE_IDS.contains(id));
    }

    @Test
    void personalitiesEndpointReturnsTheWholeCatalog() throws Exception {
        List<Personality> all = personalitiesFrom(get("/api/personalities"));

        assertThat(all).hasSameSizeAs(dataService.getPersonalities());
        assertThat(all).extracting(Personality::id).containsAll(EXPECTED_FEMALE_IDS);
    }

    /** O parametro antigo nao filtra mais nada: o catalogo vem inteiro. */
    @Test
    void representationParameterNoLongerSplitsTheCatalog() throws Exception {
        List<Personality> filtered =
                personalitiesFrom(get("/api/personalities").param("representation", "female"));

        assertThat(filtered).hasSameSizeAs(dataService.getPersonalities());
    }

    // ------------------------------------------------------------ auxiliares

    private QuizResult resultFor(String axisValues) throws Exception {
        String body = mockMvc.perform(get("/api/results/by-axes").param("v", axisValues))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readValue(body, QuizResult.class);
    }

    private List<Personality> personalitiesFrom(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        String body = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readValue(body, new TypeReference<>() {});
    }
}
