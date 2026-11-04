  async function sendRelance() {
    setWhatsappSending(true);
    setWhatsappResult(null); // On nettoie l'ancien état
    try {
      const data = await sendWhatsAppMessage({ type: 'relance_paiement', student_id: id });
      const ok = data.results?.some((r) => r.statut === 'envoye');
      const fail = data.results?.find((r) => r.statut === 'echec');
      
      if (ok) {
        // 🔥 LA NOTIFICATION TOMBE DU BAS DE L'ÉCRAN
        showToast('Relance WhatsApp envoyée');
        setWhatsappResult(null);
      } else {
        // S'il y a une erreur, on l'affiche en texte sous le bouton pour qu'elle soit lisible
        setWhatsappResult({ ok: false, text: fail?.erreur || "Échec de l'envoi." });
      }
    } catch (err) {
      setWhatsappResult({ ok: false, text: err.message });
    }
    setWhatsappSending(false);
  }
