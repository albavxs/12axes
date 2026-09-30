package com.twelveaxes.service;

import com.twelveaxes.model.AxisResult;
import com.twelveaxes.model.Personality;
import com.twelveaxes.model.PersonalityMatch;
import com.twelveaxes.model.PersonalityProfile;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class PersonalityMatcherService {
    public static final String REPRESENTATION_MALE = "male";
    public static final String REPRESENTATION_FEMALE = "female";

    private static final int TOP_MATCHES = 8;
    private static final int CATEGORY_MATCHES = 3;
    private static final int BOTTOM_MATCHES = 3;

    private final QuizDataService dataService;
    private final ProfileMatchScorer profileMatchScorer;
    private final RequestMemo<List<Object>, List<PersonalityMatch>> rankingMemo = new RequestMemo<>();

    public PersonalityMatcherService(QuizDataService dataService, ProfileMatchScorer profileMatchScorer) {
        this.dataService = dataService;
        this.profileMatchScorer = profileMatchScorer;
    }

    public List<PersonalityMatch> findMatches(List<AxisResult> axisResults) {
        return findMatches(axisResults, QuizDataService.LANG_PT);
    }

    public List<PersonalityMatch> findMatches(List<AxisResult> axisResults, String lang) {
        return findMatches(axisResults, lang, REPRESENTATION_MALE);
    }

    public List<PersonalityMatch> findMatches(List<AxisResult> axisResults, String lang, String representation) {
        return rankAll(axisResults, lang, representation).stream()
                .limit(TOP_MATCHES)
                .toList();
    }

    public List<PersonalityMatch> findMixedMatches(List<AxisResult> axisResults, String lang) {
        return rankAll(axisResults, lang, null).stream()
                .limit(TOP_MATCHES)
                .toList();
    }

    public PersonalityMatch findTopMatch(List<AxisResult> axisResults) {
        return findTopMatch(axisResults, QuizDataService.LANG_PT);
    }

    public PersonalityMatch findTopMatch(List<AxisResult> axisResults, String lang) {
        return findMatches(axisResults, lang).getFirst();
    }

    public PersonalityMatch findTopMatch(List<AxisResult> axisResults, String lang, String representation) {
        List<PersonalityMatch> matches = findMatches(axisResults, lang, representation);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    public PersonalityMatch findTopMixedMatch(List<AxisResult> axisResults, String lang) {
        List<PersonalityMatch> matches = findMixedMatches(axisResults, lang);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    // Tres personalidades de categorias distintas entre si e diferentes da
    // categoria da mais compativel: percorre o ranking de cima para baixo e
    // pega a primeira de cada categoria ainda nao vista.
    public List<PersonalityMatch> findCategoryMatches(List<AxisResult> axisResults, String lang) {
        return findCategoryMatches(axisResults, lang, REPRESENTATION_MALE);
    }

    public List<PersonalityMatch> findCategoryMatches(List<AxisResult> axisResults, String lang, String representation) {
        List<PersonalityMatch> ranking = rankAll(axisResults, lang, representation);
        if (ranking.isEmpty()) {
            return List.of();
        }

        Set<String> categoriasVistas = new LinkedHashSet<>();
        categoriasVistas.add(ranking.getFirst().category());

        List<PersonalityMatch> selecionadas = new ArrayList<>();
        for (PersonalityMatch match : ranking) {
            if (selecionadas.size() == CATEGORY_MATCHES) {
                break;
            }
            if (categoriasVistas.add(match.category())) {
                selecionadas.add(match);
            }
        }
        return List.copyOf(selecionadas);
    }

    // A personalidade mais compativel de CADA categoria do catalogo, da categoria
    // mais compativel para a menos. Diferente de findCategoryMatches, que so
    // devolve tres: aqui nenhuma area de atuacao fica de fora.
    public List<PersonalityMatch> findBestPerCategory(List<AxisResult> axisResults, String lang) {
        return findBestPerCategory(axisResults, lang, REPRESENTATION_MALE);
    }

    public List<PersonalityMatch> findBestPerCategory(List<AxisResult> axisResults, String lang, String representation) {
        Map<String, PersonalityMatch> melhorPorCategoria = new LinkedHashMap<>();
        for (PersonalityMatch match : rankAll(axisResults, lang, representation)) {
            if (match.category() != null) {
                melhorPorCategoria.putIfAbsent(match.category(), match);
            }
        }
        return melhorPorCategoria.values().stream()
                .sorted(Comparator.comparingDouble(PersonalityMatch::compatibility).reversed())
                .toList();
    }

    public List<PersonalityMatch> findMixedBestPerCategory(List<AxisResult> axisResults, String lang) {
        Map<String, PersonalityMatch> bestByCategory = new LinkedHashMap<>();
        for (PersonalityMatch match : rankAll(axisResults, lang, null)) {
            if (match.category() != null) {
                bestByCategory.putIfAbsent(match.category(), match);
            }
        }
        return bestByCategory.values().stream()
                .sorted(Comparator.comparingDouble(PersonalityMatch::compatibility).reversed())
                .limit(TOP_MATCHES)
                .toList();
    }

    // As tres menos compativeis do catalogo inteiro, em ordem crescente.
    public List<PersonalityMatch> findBottomMatches(List<AxisResult> axisResults, String lang) {
        return findBottomMatches(axisResults, lang, REPRESENTATION_MALE);
    }

    public List<PersonalityMatch> findBottomMatches(List<AxisResult> axisResults, String lang, String representation) {
        List<PersonalityMatch> ranking = rankAll(axisResults, lang, representation);
        return ranking.stream()
                .skip(Math.max(0, ranking.size() - BOTTOM_MATCHES))
                .sorted(Comparator.comparingDouble(PersonalityMatch::compatibility))
                .toList();
    }

    public List<PersonalityMatch> findMixedBottomMatches(List<AxisResult> axisResults, String lang) {
        List<PersonalityMatch> ranking = rankAll(axisResults, lang, null);
        return ranking.stream()
                .skip(Math.max(0, ranking.size() - BOTTOM_MATCHES))
                .sorted(Comparator.comparingDouble(PersonalityMatch::compatibility))
                .toList();
    }

    // Ranking completo do catalogo, do mais ao menos compativel. Todos os
    // recortes (topo, categorias, opostos) saem desta mesma lista.
    private List<PersonalityMatch> rankAll(List<AxisResult> axisResults, String lang, String representation) {
        String normalizedRepresentation = normalizeRepresentation(representation);
        String cacheRepresentation = normalizedRepresentation == null ? "all" : normalizedRepresentation;
        return rankingMemo.get(List.of(QuizDataService.normalizeLang(lang), cacheRepresentation, axisResults),
                () -> computeRanking(axisResults, lang, normalizedRepresentation));
    }

    private List<PersonalityMatch> computeRanking(List<AxisResult> axisResults, String lang, String representation) {
        Map<String, Double> userVector = profileMatchScorer.userVectorFor(axisResults);

        Comparator<PersonalityCandidate> byScore =
                Comparator.comparingDouble(PersonalityCandidate::compatibility).reversed();
        Comparator<PersonalityCandidate> byName = Comparator.comparing(candidate -> candidate.personality().name());

        List<PersonalityCandidate> candidates = dataService.getPersonalities(QuizDataService.normalizeLang(lang)).stream()
                .filter(personality -> representation == null || representation.equals(representationOf(personality)))
                .map(personality -> toCandidate(personality, userVector))
                .toList();
        List<Double> catalogScores = candidates.stream()
                .map(PersonalityCandidate::compatibility)
                .toList();

        double[] percentiles = profileMatchScorer.percentiles(catalogScores);
        return java.util.stream.IntStream.range(0, candidates.size())
                .mapToObj(i -> new PersonalityCandidate(candidates.get(i).personality(), candidates.get(i).compatibility(), percentiles[i]))
                .sorted(byScore.thenComparing(byName))
                .map(this::toMatch)
                .toList();
    }

    private PersonalityCandidate toCandidate(Personality personality, Map<String, Double> userVector) {
        double compatibility = profileMatchScorer.compatibility(userVector, targetVectorFor(personality));
        return new PersonalityCandidate(personality, compatibility, 0.0);
    }

    private PersonalityMatch toMatch(PersonalityCandidate candidate) {
        Personality personality = candidate.personality();
        return new PersonalityMatch(
                personality.id(),
                personality.name(),
                personality.role(),
                personality.category(),
                representationOf(personality),
                personality.lifespan(),
                personality.description(),
                personality.imagePath(),
                personality.imageSourceName(),
                personality.imageSourceUrl(),
                personality.imageNote(),
                candidate.compatibility(),
                candidate.compatibilityPercentile(),
                targetVectorFor(personality)
        );
    }

    private List<PersonalityMatch> interleave(
            List<PersonalityMatch> first,
            List<PersonalityMatch> second,
            int limit) {
        List<PersonalityMatch> selected = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        int max = Math.max(first.size(), second.size());
        for (int i = 0; i < max && selected.size() < limit; i++) {
            addIfUnseen(selected, seen, first, i, limit);
            addIfUnseen(selected, seen, second, i, limit);
        }
        return List.copyOf(selected);
    }

    private void addIfUnseen(
            List<PersonalityMatch> selected,
            Set<String> seen,
            List<PersonalityMatch> candidates,
            int index,
            int limit) {
        if (selected.size() >= limit || index >= candidates.size()) {
            return;
        }
        PersonalityMatch match = candidates.get(index);
        if (seen.add(match.personalityId())) {
            selected.add(match);
        }
    }

    private String normalizeRepresentation(String representation) {
        if (representation == null || representation.isBlank()) {
            return null;
        }
        return switch (representation.trim().toLowerCase()) {
            case REPRESENTATION_FEMALE -> REPRESENTATION_FEMALE;
            default -> REPRESENTATION_MALE;
        };
    }

    public static String representationOf(Personality personality) {
        if (personality.representation() == null || personality.representation().isBlank()) {
            return REPRESENTATION_MALE;
        }
        return switch (personality.representation().trim().toLowerCase()) {
            case REPRESENTATION_FEMALE -> REPRESENTATION_FEMALE;
            default -> REPRESENTATION_MALE;
        };
    }

    private Map<String, Double> targetVectorFor(Personality personality) {
        PersonalityProfile profile = dataService.getPersonalityProfiles().get(personality.id());
        if (profile != null && profile.vector() != null && !profile.vector().isEmpty()) {
            return profile.vector();
        }
        return profileMatchScorer.neutralVector();
    }

    private record PersonalityCandidate(
            Personality personality,
            double compatibility,
            double compatibilityPercentile
    ) {
    }
}
