package com.twelveaxes.model;

import java.util.List;

/**
 * Resultado completo do quiz: a posicao do usuario nos 12 eixos e os recortes
 * de afinidade e de distancia em cada catalogo (ideologias, paises e
 * personalidades).
 *
 * @param axes resultado do usuario em cada um dos 12 eixos
 * @param topMatch ideologia mais compativel
 * @param matches ideologias mais compativeis, a comecar pela do topo
 * @param bottomIdeologyMatch ideologia mais distante do catalogo
 * @param topCountryMatch pais atual mais compativel
 * @param topCountryMatches os 3 mais compativeis do catalogo inteiro (paises e experiencias
 *     historicas juntos, sem distincao), a comecar pelo topo
 * @param topHistoricalCountryMatch experiencia historica mais compativel
 * @param bottomCountryMatches paises mais distantes do catalogo
 * @param topPersonalityMatch personalidade masculina mais compativel, mantendo o contrato legado
 * @param personalityMatches personalidades masculinas mais compativeis, sem filtro por categoria
 * @param dimensionMatches personalidade masculina mais compativel em cada dimensao (politica, social, economica)
 * @param categoryBestMatches personalidade masculina mais compativel de cada area de atuacao
 * @param bottomPersonalityMatches personalidades masculinas mais distantes do catalogo
 * @param topFemalePersonalityMatch personalidade feminina mais compativel, ou null quando nao houver catalogo feminino
 * @param femalePersonalityMatches personalidades femininas mais compativeis
 * @param femaleDimensionMatches personalidade feminina mais compativel em cada dimensao
 * @param femaleCategoryBestMatches personalidade feminina mais compativel de cada area de atuacao
 * @param bottomFemalePersonalityMatches personalidades femininas mais distantes do catalogo
 * @param topMixedPersonalityMatch primeira personalidade no ranking misto
 * @param mixedPersonalityMatches personalidades masculinas e femininas intercaladas por compatibilidade
 * @param mixedDimensionMatches personalidade mais compativel em cada dimensao sem filtro de representacao
 * @param mixedCategoryBestMatches personalidades por area em composicao mista
 * @param bottomMixedPersonalityMatches personalidades mais distantes em composicao mista
 * @param mostUnusualAxis eixo em que o usuario mais destoa do catalogo de ideologias
 * @param mostCommonAxis eixo em que o usuario mais se aproxima do catalogo
 * @param axisTension par de eixos em que o usuario contraria o padrao do catalogo, ou null
 * @param bookRecommendations livros masculinos mais compativeis (contrato legado, ate 3)
 * @param femaleBookRecommendations livros das personalidades femininas mais compativeis (ate 3)
 * @param mixedBookRecommendations livros do ranking global misto mais compativeis (ate 3)
 */
public record QuizResult(
        List<AxisResult> axes,
        IdeologyMatch topMatch,
        List<IdeologyMatch> matches,
        IdeologyMatch bottomIdeologyMatch,
        CountryMatch topCountryMatch,
        List<CountryMatch> topCountryMatches,
        CountryMatch topHistoricalCountryMatch,
        List<CountryDimensionMatch> countryDimensionMatches,
        List<CountryMatch> bottomCountryMatches,
        PersonalityMatch topPersonalityMatch,
        List<PersonalityMatch> personalityMatches,
        List<DimensionMatch> dimensionMatches,
        List<PersonalityMatch> categoryBestMatches,
        List<PersonalityMatch> bottomPersonalityMatches,
        PersonalityMatch topFemalePersonalityMatch,
        List<PersonalityMatch> femalePersonalityMatches,
        List<DimensionMatch> femaleDimensionMatches,
        List<PersonalityMatch> femaleCategoryBestMatches,
        List<PersonalityMatch> bottomFemalePersonalityMatches,
        PersonalityMatch topMixedPersonalityMatch,
        List<PersonalityMatch> mixedPersonalityMatches,
        List<DimensionMatch> mixedDimensionMatches,
        List<PersonalityMatch> mixedCategoryBestMatches,
        List<PersonalityMatch> bottomMixedPersonalityMatches,
        AxisOutlier mostUnusualAxis,
        AxisOutlier mostCommonAxis,
        AxisTension axisTension,
        List<BookRecommendation> bookRecommendations,
        List<BookRecommendation> femaleBookRecommendations,
        List<BookRecommendation> mixedBookRecommendations
) {
}
