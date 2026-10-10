package com.twelveaxes.service;

import com.twelveaxes.model.Book;
import com.twelveaxes.model.BookRecommendation;
import com.twelveaxes.model.PersonalityMatch;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class BookRecommendationService {
    static final int MAX_BOOKS = 3;
    // Uma conta de Associados por loja: a tag do Brasil nao rende nada na amazon.com.
    static final String AMAZON_BR_HOST = "www.amazon.com.br";
    static final String AMAZON_BR_TAG = "12axes-20";
    static final String AMAZON_US_HOST = "www.amazon.com";
    static final String AMAZON_US_TAG = "12axes0d-20";

    private final QuizDataService dataService;

    public BookRecommendationService(QuizDataService dataService) {
        this.dataService = dataService;
    }

    /**
     * Livros das personalidades mais compativeis (geral + melhor de cada area de
     * atuacao) que tem livro cadastrado, da maior para a menor compatibilidade.
     */
    public List<BookRecommendation> recommend(
            List<PersonalityMatch> rankedMatches,
            String lang
    ) {
        String normalizedLang = QuizDataService.normalizeLang(lang);
        Map<String, Book> books = dataService.getBooks();

        return rankedMatches.stream()
                .filter(match -> hasAvailableBook(books.get(match.personalityId()), normalizedLang))
                .limit(MAX_BOOKS)
                .map(match -> toRecommendation(match, books.get(match.personalityId()), normalizedLang))
                .toList();
    }

    private boolean hasAvailableBook(Book book, String lang) {
        return book != null
                && localized(book.title(), lang) != null
                && !localized(book.title(), lang).isBlank();
    }

    private BookRecommendation toRecommendation(PersonalityMatch match, Book book, String lang) {
        String title = localized(book.title(), lang);
        String author = book.author() == null || book.author().isBlank() ? match.name() : book.author();
        String associationType = book.associationType() == null || book.associationType().isBlank()
                ? "author"
                : book.associationType();
        return new BookRecommendation(
                match.personalityId(),
                match.name(),
                match.imagePath(),
                title,
                book.year(),
                affiliateUrl(localized(book.url(), lang), title, author, lang),
                author,
                associationType,
                match.compatibility()
        );
    }

    /**
     * Primeiro autor creditado, para a busca gerada. A linha de credito completa
     * ("Vilma Espin, Asela de los Santos, Yolanda Ferrer") transforma a busca
     * numa frase longa que nao casa com nenhuma entrada de catalogo: a Amazon
     * responde "Nenhum resultado". O credito completo continua na exibicao.
     */
    static String searchAuthor(String author) {
        if (author == null || author.isBlank()) {
            return "";
        }
        String first = author.split(",|&| and ")[0].trim();
        return first.isEmpty() ? author.trim() : first;
    }

    static String affiliateUrl(String directUrl, String title, String author, String lang) {
        if (directUrl != null && !directUrl.isBlank()) {
            return directUrl;
        }
        boolean english = QuizDataService.LANG_EN.equals(lang);
        String terms = (title + " " + searchAuthor(author)).trim();
        String query = URLEncoder.encode(terms, StandardCharsets.UTF_8);
        return "https://" + (english ? AMAZON_US_HOST : AMAZON_BR_HOST)
                + "/s?k=" + query + "&i=stripbooks&tag=" + (english ? AMAZON_US_TAG : AMAZON_BR_TAG);
    }

    private static String localized(Map<String, String> values, String lang) {
        if (values == null) {
            return null;
        }
        String value = values.get(lang);
        return value == null || value.isBlank() ? values.get(QuizDataService.LANG_PT) : value;
    }
}
