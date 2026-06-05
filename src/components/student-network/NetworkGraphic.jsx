const mentorTeamImage = `${import.meta.env.BASE_URL}media/mentor-team-cards.png`;

export default function NetworkGraphic() {
  const { t } = useLanguage();
  const majorLabel = (major) => major.label ?? t(`studentNetwork.graphic.majors.${major.key}`);

  return (
    <div className="sn-network-graphic" aria-hidden="true">
      <div className="sn-network-graphic__stage">
        <img
          src={mentorTeamImage}
          alt=""
          className="sn-network-graphic__image"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
