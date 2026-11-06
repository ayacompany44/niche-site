# NICHE® — mise en ligne sur Netlify

Site statique (`public/`) + fonctions Netlify (`netlify/functions/`) qui stockent les rêves et les photos dans **Netlify Blobs**. Aucun autre service, aucun compte externe.

## Important : pas de glisser-déposer
Netlify Drop (glisser un dossier sur netlify.com) ne publie **que** les fichiers statiques : les rêves ne s'afficheraient pas et le formulaire ne marcherait pas. Utilise l'une des deux méthodes ci-dessous.

## Méthode A — via GitHub (recommandée)
1. Crée un dépôt GitHub (ex. `niche-site`) et envoie-y **tout le contenu de ce dossier** (sauf `node_modules`).
2. Sur Netlify : **Add new site → Import an existing project → GitHub** → choisis le dépôt.
3. Laisse les réglages proposés (ils viennent de `netlify.toml`) et clique **Deploy**.
4. Une fois en ligne : **Site configuration → Environment variables → Add a variable**
   - Clé : `ADMIN_PASSWORD`
   - Valeur : un mot de passe long, connu de toi seul.
5. **Deploys → Trigger deploy → Deploy site** pour que le mot de passe soit pris en compte.

## Méthode B — en ligne de commande
```bash
npm install -g netlify-cli
cd niche-site
npm install
netlify login
netlify init          # crée le site
netlify env:set ADMIN_PASSWORD "ton-mot-de-passe"
netlify deploy --prod
```

## Utilisation
- **Lire** : tout le monde, sans compte. 5 rêves d'exemple (signés « La rédaction NICHE », marqués « Exemple ») sont créés automatiquement à la première visite pour que le magazine ne soit pas vide.
- **Partager un rêve** : bouton « + PARTAGER MON RÊVE ». Chaque envoi reste **en attente** et invisible.
- **Modérer** : `ton-site.netlify.app/#moderation` (lien « Modération » en pied de page) → mot de passe `ADMIN_PASSWORD`. Publier, publier à la une, refuser (supprime aussi les photos), retirer un rêve publié, retirer les exemples.

## Limites intégrées
- Photos : JPG, PNG, WEBP · 15 Mo max avant envoi · 6 par rêve · redimensionnées à 1600 px et compressées dans le navigateur.
- Texte : titre 110 caractères, histoire 5 000 caractères.
- Anti-spam : champ piège invisible + délai minimal de remplissage.
- Les photos d'un rêve en attente ne sont visibles qu'avec le mot de passe de modération.
- Rêve anonyme : le nom et l'Instagram ne sont pas copiés dans la version publiée.

## À personnaliser
- Adresse de contact (page Confidentialité) : `ayacompany44@gmail.com` dans `public/index.html`.
- Nom de domaine : Netlify → **Domain management** (ex. un domaine OVH).
