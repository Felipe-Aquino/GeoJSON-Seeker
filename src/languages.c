enum Languages {
  LANG_EN = 0,
  LANG_PT_BR,
};

enum Translations {
  TR_NOT_SUPPORTED = 0,
  TR_LOADING_MAP,
  TR_ADD_POINTS,
  TR_REMOVE_POINTS,
  TR_CONNECT_POINTS,
  TR_COPY,
  COUNT_TRANSLATIONS,
};

static const char *__pt_br[COUNT_TRANSLATIONS] = {
    "Ops! Este site não é compatível.",
    "Carregando Mapa",
    "Marcar pontos",
    "Remover pontos",
    "Conectar pontos",
    "Copiar"
};

static const char *__en[COUNT_TRANSLATIONS] = {
    "Oops! This site isn't supported.",
    "Loading Map",
    "Add points",
    "Remove points",
    "Connect points",
    "Copy"
};

static const char **translations = __en;

void set_language_translation(enum Languages lang) {
    if (lang == LANG_PT_BR) {
        translations = __pt_br;
    } else {
        translations = __en;
    }
}

#define _TR(t) translations[TR_ ##t]
