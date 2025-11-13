const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
const justificatifsDir = path.join(uploadsDir, 'justificatifs');

try {
    if (!fs.existsSync(uploadsDir)) {
        console.log(`Création du dossier d'upload: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(justificatifsDir)) {
        console.log(`Création du dossier des justificatifs: ${justificatifsDir}`);
        fs.mkdirSync(justificatifsDir, { recursive: true });
    }
} catch (error) {
    console.error('Erreur lors de la création des dossiers:', error);
    throw new Error('Impossible de créer les dossiers nécessaires pour le stockage des fichiers');
}

// Configuration du stockage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, justificatifsDir);
    },
    filename: function (req, file, cb) {
        // Nettoyer le nom du fichier
        const originalname = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(originalname) || '';
        const filename = `justificatif-${uniqueSuffix}${extension}`.toLowerCase();
        
        console.log(`Téléchargement du fichier: ${filename} (${file.mimetype}, ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        cb(null, filename);
    }
});

// Filtre pour les types de fichiers acceptés
const fileFilter = (req, file, cb) => {
    // Types de fichiers acceptés : images et PDF
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ];

    console.log(`Vérification du type de fichier: ${file.mimetype}`);
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        console.error(`Type de fichier rejeté: ${file.mimetype}`);
        cb(new Error('Type de fichier non supporté. Seuls les images (JPEG, PNG, GIF, WebP) et les PDF sont acceptés.'), false);
    }
};

// Configuration multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1, // 1 fichier max
        fieldNameSize: 200, // Taille max du nom du champ
        fieldSize: 5 * 1024 * 1024 // Taille max des champs (5MB)
    },
    fileFilter: fileFilter,
    preservePath: true
});

// Middleware pour gérer les erreurs de multer
const handleUpload = (req, res, next) => {
    const uploadSingle = upload.single('justificatif');
    
    uploadSingle(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            // Une erreur de Multer s'est produite lors du téléchargement
            console.error('Erreur Multer:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ 
                    message: 'Le fichier est trop volumineux. La taille maximale autorisée est de 5 Mo.' 
                });
            } else if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ 
                    message: 'Trop de fichiers. Un seul fichier est autorisé.' 
                });
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ 
                    message: 'Champ de fichier incorrect. Le champ doit s\'appeler "justificatif".' 
                });
            }
            return res.status(400).json({ 
                message: 'Erreur lors du téléchargement du fichier',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        } else if (err) {
            // Une erreur inconnue s'est produite
            console.error('Erreur inconnue lors du téléchargement:', err);
            return res.status(500).json({ 
                message: 'Erreur lors du traitement du fichier',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
        
        // Si tout s'est bien passé, passer au middleware suivant
        next();
    });
};

module.exports = {
    upload,
    handleUpload
};
