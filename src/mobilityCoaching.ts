export interface MobilityCoaching {
  name: string;
  mode: 'stretching' | 'mobility';
  dose: string;
  feel: string;
  avoid: string;
  easier: string;
  instructions: string[];
  equipment: string;
  tags: string[];
}

function stretch(
  name: string,
  feel: string,
  avoid: string,
  easier: string,
  instructions: string[],
  equipment = 'body only',
  tags: string[] = [],
): MobilityCoaching {
  return {
    name,
    mode: 'stretching',
    dose: '15–20 sec each side · 1–2 rounds',
    feel,
    avoid,
    easier,
    instructions,
    equipment,
    tags,
  };
}
function move(
  name: string,
  dose: string,
  feel: string,
  avoid: string,
  easier: string,
  instructions: string[],
  tags: string[] = [],
): MobilityCoaching {
  return { name, mode: 'mobility', dose, feel, avoid, easier, instructions, equipment: 'body only', tags };
}

// Original coaching for the matching public-domain Free Exercise DB demonstrations.
// These are starting doses, not personalized prescriptions.
export const MOBILITY_COACHING: Record<string, MobilityCoaching> = {
  Ankle_On_The_Knee: stretch(
    'Lying Figure-4 Glute Stretch',
    'The buttock and outer hip of the crossed leg.',
    'Pressing on the crossed knee or lifting your head to reach.',
    'Keep the bottom foot on the floor and simply hold the figure-4 position.',
    [
      'Lie on your back with knees bent and both feet on the floor. Rest one ankle across the opposite thigh, just above the knee.',
      'Thread your hands behind the uncrossed thigh. Bring that thigh toward your chest until you feel a gentle stretch in the other buttock.',
      'Keep your head resting down and the crossed foot gently flexed. Breathe, release slowly, then swap legs.',
    ],
    'body only',
    ['piriformis', 'glutes', 'hips', 'cool down'],
  ),
  Kneeling_Hip_Flexor: stretch(
    'Half-Kneeling Hip Flexor Stretch',
    'The front of the hip on the kneeling side.',
    'Arching your lower back or lunging farther to chase a deeper stretch.',
    'Put a folded towel under the back knee and use a chair for balance.',
    [
      'Kneel on a padded surface and step one foot forward into a half-kneeling stance.',
      'Stand your torso tall, gently tuck your pelvis, and squeeze the buttock on the kneeling side.',
      'Move your hips forward a small amount without losing that position. Hold, then switch sides.',
    ],
    'exercise mat',
    ['hips', 'hip flexors', 'quads', 'cool down'],
  ),
  Hamstring_Stretch: stretch(
    'Lying Hamstring Stretch with Strap',
    'The back of the raised thigh; a little calf tension is normal.',
    'Locking the knee or pulling hard on the toes.',
    'Bend the raised knee a little or lower the leg until the tension eases.',
    [
      'Lie on your back and loop a strap or towel around one foot. Raise that leg toward the ceiling.',
      'Keep the other leg resting on the floor. Hold the strap ends and gently draw the raised leg toward you.',
      'Keep your shoulders relaxed and your knee soft. Hold a comfortable position, then switch legs.',
    ],
    'strap or towel',
    ['hamstrings', 'back of thigh', 'cool down'],
  ),
  Seated_Floor_Hamstring_Stretch: stretch(
    'Seated Single-Leg Hamstring Stretch',
    'The back of the straight thigh.',
    'Rounding your back just to reach your toes.',
    'Sit on a folded towel and keep a slight bend in the extended knee.',
    [
      'Sit with one leg forward and the other knee bent outward, sole resting near the inner thigh.',
      'Lengthen your spine and hinge forward from your hips toward the straight leg.',
      'Rest your hands wherever they reach. Pause at mild tension, then repeat on the other side.',
    ],
    'body only',
    ['hamstrings', 'back of thigh', 'cool down'],
  ),
  On_Your_Side_Quad_Stretch: stretch(
    'Side-Lying Quad Stretch',
    'The front of the top thigh.',
    'Pulling the heel hard or allowing your lower back to arch.',
    'Use a strap around the foot if reaching it twists your torso.',
    [
      'Lie on your side with the bottom knee bent in front of you for balance.',
      'Bend the top knee behind you and hold that foot with the top hand.',
      'Keep your hips stacked. Gently draw your heel toward your buttock without arching your back, then change sides.',
    ],
    'body only',
    ['quadriceps', 'front of thigh', 'cool down'],
  ),
  Calf_Stretch_Hands_Against_Wall: stretch(
    'Straight-Knee Wall Calf Stretch',
    'The upper calf of the back leg.',
    'Turning the rear foot outward or letting its heel lift.',
    'Shorten the distance between your feet.',
    [
      'Face a wall and place your hands against it. Step one foot behind you with toes pointing forward.',
      'Bend the front knee while keeping the back knee straight and the back heel heavy on the floor.',
      'Lean toward the wall until the calf stretches gently. Hold, release, and switch feet.',
    ],
    'wall',
    ['calves', 'ankles', 'gastrocnemius', 'cool down'],
  ),
  Standing_Soleus_And_Achilles_Stretch: stretch(
    'Bent-Knee Calf Stretch',
    'The lower calf of the back leg.',
    'Lifting the back heel or pushing into ankle pinching.',
    'Use a smaller stance and hold a wall for balance.',
    [
      'Stand with one foot a short step behind the other, both feet pointing forward.',
      'Bend both knees slightly while keeping the back heel on the floor.',
      'Lower only until you feel a comfortable lower-calf stretch. Hold, then switch sides.',
    ],
    'body only',
    ['calves', 'ankles', 'soleus', 'achilles'],
  ),
  Seated_Calf_Stretch: stretch(
    'Seated Calf Stretch with Towel',
    'The calf of the extended leg.',
    'Jerking the towel or forcing the knee straight.',
    'Bend the extended knee slightly and reduce the pull.',
    [
      'Sit upright with one leg extended and the other knee bent, foot on the floor.',
      'Loop a towel or band around the ball of the extended foot.',
      'Draw the towel gently toward you so the toes move back. Keep your spine tall; hold and swap legs.',
    ],
    'strap or towel',
    ['calves', 'ankles'],
  ),
  Shoulder_Stretch: stretch(
    'Cross-Body Shoulder Stretch',
    'The back of the shoulder on the reaching arm.',
    'Shrugging or pressing directly on the elbow joint.',
    'Lower the reaching arm slightly and use less pressure.',
    [
      'Sit or stand tall and bring one arm across the front of your chest.',
      'Use the other hand or forearm to support the upper arm above the elbow.',
      'Draw the arm gently across while keeping its shoulder down. Hold and switch arms.',
    ],
    'body only',
    ['rear delts', 'shoulders', 'desk', 'upper body'],
  ),
  Triceps_Stretch: stretch(
    'Overhead Triceps Stretch',
    'The back of the raised upper arm.',
    'Forcing the elbow behind your head or flaring your ribs.',
    'Let the elbow sit a little farther forward and use a lighter touch.',
    [
      'Lift one arm overhead, then bend its elbow so the hand reaches toward your upper back.',
      'Place the other hand lightly on the raised elbow.',
      'Keep your ribs down and ease the elbow back only as far as comfortable. Hold, then switch arms.',
    ],
    'body only',
    ['triceps', 'arms', 'upper body'],
  ),
  Upper_Back_Stretch: {
    ...stretch(
      'Reaching Upper-Back Stretch',
      'Across the shoulder blades.',
      'Collapsing your whole torso or holding your breath.',
      'Reach a shorter distance and keep the elbows soft.',
      [
        'Sit or stand upright and clasp your hands in front of you, thumbs pointing down.',
        'Reach forward and let your shoulder blades spread apart. Gently round the upper back.',
        'Keep your neck easy and breathe into the space between your shoulder blades.',
      ],
      'body only',
      ['thoracic', 'upper back', 'desk'],
    ),
    dose: '15–20 sec · 1–2 rounds',
  },
  Side_Neck_Stretch: stretch(
    'Gentle Side-Neck Stretch',
    'The side of the neck opposite the tilt.',
    'Pulling on your head, rotating it, or lifting the opposite shoulder.',
    'Make the tilt smaller; your ear does not need to approach the shoulder.',
    [
      'Sit or stand tall with both shoulders relaxed.',
      'Slowly tilt one ear toward the same-side shoulder. Let the weight of your head provide the stretch; no hand pressure is needed.',
      'Pause at light tension, return to the middle slowly, then change sides.',
    ],
    'body only',
    ['neck', 'traps', 'desk'],
  ),
  Standing_Biceps_Stretch: {
    ...stretch(
      'Hands-Behind-Back Biceps Stretch',
      'The front of the upper arms and chest.',
      'Lifting your hands high or pushing through shoulder discomfort.',
      'Keep the hands low and the elbows slightly bent.',
      [
        'Stand tall and clasp your hands behind your lower back.',
        'Gently straighten the elbows and turn your clasped palms downward if comfortable.',
        'Lift the hands only a little, keeping your ribs and chin level. Hold and relax.',
      ],
      'body only',
      ['biceps', 'chest', 'upper body'],
    ),
    dose: '15–20 sec · 1–2 rounds',
  },
  Kneeling_Forearm_Stretch: {
    ...stretch(
      'Kneeling Wrist and Forearm Stretch',
      'The palm side of the forearms.',
      'Forcing your palms flat or placing all your weight into your wrists.',
      'Shift less weight onto the hands and turn the fingers back only as far as comfortable.',
      [
        'Kneel on a mat and place your palms on the floor with fingers pointing toward your knees.',
        'Keep your elbows soft and slowly shift your hips backward a few centimetres.',
        'Stop at a light forearm stretch. Reduce pressure immediately if your wrists hurt.',
      ],
      'exercise mat',
      ['wrists', 'forearms', 'hands'],
    ),
    dose: '15–20 sec · 1–2 rounds',
  },
  One_Knee_To_Chest: stretch(
    'Single Knee-to-Chest Stretch',
    'The buttock and lower back on the bent-leg side.',
    'Pulling on the kneecap or lifting your head off the floor.',
    'Bend the resting leg and put that foot on the floor.',
    [
      'Lie on your back with one leg resting long.',
      'Bend the other knee and hold behind its thigh. Gently draw it toward your chest.',
      'Keep your head and shoulders resting down. Breathe through the hold, then change legs.',
    ],
    'body only',
    ['glutes', 'lower back', 'cool down'],
  ),
  Knee_Across_The_Body: stretch(
    'Lying Cross-Body Glute Stretch',
    'The outer hip and buttock of the crossed leg.',
    'Forcing the knee to the floor or twisting into back pain.',
    'Rest the crossed knee on a cushion and keep the range small.',
    [
      'Lie on your back with one leg long and the other knee bent.',
      'Guide the bent knee gently across your body with the opposite hand.',
      'Let the same-side arm rest out beside you. Keep the rotation comfortable, hold, and switch sides.',
    ],
    'body only',
    ['glutes', 'hips', 'lower back'],
  ),
  The_Straddle: {
    ...stretch(
      'Seated Straddle Stretch',
      'The inner thighs and back of the legs.',
      'Forcing a wider split or rounding to reach farther.',
      'Sit on a folded towel and bring your legs closer together.',
      [
        'Sit tall and open your legs into a comfortable V shape.',
        'Place your hands on the floor in front of you and hinge forward from the hips a little.',
        'Keep knees and toes facing up. Hold at light tension, then use your hands to sit upright.',
      ],
      'body only',
      ['groin', 'adductors', 'inner thighs', 'hamstrings'],
    ),
    dose: '15–20 sec · 1–2 rounds',
  },
  Childs_Pose: {
    ...stretch(
      'Child’s Pose',
      'A gentle lengthening through the back.',
      'Forcing your hips onto your heels or compressing painful knees.',
      'Place a cushion between hips and heels and support your forehead.',
      [
        'Start on hands and knees on a padded surface and walk your hands forward.',
        'Ease your hips back toward your heels, staying within a comfortable range for your knees.',
        'Rest your forehead on the floor or a cushion. Let your arms relax beside your legs if comfortable, and breathe slowly.',
      ],
      'exercise mat',
      ['back', 'lats', 'cool down'],
    ),
    dose: '20–30 sec · 1–2 rounds',
  },
  Standing_Lateral_Stretch: stretch(
    'Standing Side-Body Stretch',
    'The side of the trunk opposite the lean.',
    'Twisting your chest or shifting all your weight to one foot.',
    'Keep the upper hand at your hip and use a smaller side bend.',
    [
      'Stand with feet a little wider than hip width and knees soft.',
      'Place one hand on your hip and raise the other arm, resting that hand behind your head.',
      'Lean away from the raised arm while keeping your chest facing forward. Hold and switch sides.',
    ],
    'body only',
    ['obliques', 'side body', 'desk'],
  ),
  Standing_Hip_Flexors: stretch(
    'Standing Hip Flexor Stretch',
    'The front of the hip on the back-leg side.',
    'Arching your back or taking an unstable, very long stance.',
    'Hold a chair and shorten the stance.',
    [
      'Stand in a short split stance with your torso upright.',
      'Bend both knees slightly and let the back heel rise.',
      'Gently tuck your pelvis and bring the back hip forward. Keep the movement small; hold and switch legs.',
    ],
    'body only',
    ['hip flexors', 'hips', 'desk'],
  ),
  Ankle_Circles: move(
    'Supported Ankle Circles',
    '5–10 circles each way · each ankle',
    'Smooth movement around the ankle.',
    'Rotating your whole leg to make the circle larger.',
    'Sit in a chair and lift one foot instead.',
    [
      'Stand beside a solid support and hold it for balance. Lift one foot just off the floor.',
      'Slowly trace a circle with the big toe, moving at the ankle.',
      'Reverse direction, then switch feet. Keep the circles comfortable and controlled.',
    ],
    ['ankles', 'warm up', 'feet'],
  ),
  Arm_Circles: move(
    'Arm Circles',
    '10 sec each direction · 1–2 rounds',
    'Easy movement through both shoulders.',
    'Swinging quickly or shrugging your shoulders toward your ears.',
    'Lower your arms and draw smaller circles.',
    [
      'Stand tall and raise your arms out to the sides at a comfortable height.',
      'Draw small, slow circles with both arms while keeping your torso still.',
      'Reverse direction. Increase the size only if your shoulders remain comfortable.',
    ],
    ['shoulders', 'warm up', 'upper body'],
  ),
  Shoulder_Circles: move(
    'Shoulder Rolls',
    '5–10 rolls each direction',
    'The shoulder blades gliding around your ribcage.',
    'Tensing your neck or rolling too fast.',
    'Do the movement seated, one shoulder at a time.',
    [
      'Let your arms hang loosely beside you, or rest them in your lap.',
      'Slowly roll your shoulders forward, up, back, and down.',
      'Reverse the sequence and keep breathing normally.',
    ],
    ['shoulders', 'upper back', 'desk', 'warm up'],
  ),
  Standing_Hip_Circles: move(
    'Supported Hip Circles',
    '5 slow circles each direction · each leg',
    'Controlled rotation at the lifted hip.',
    'Twisting your torso or forcing the knee higher.',
    'Lift the knee less and make a smaller circle.',
    [
      'Stand beside a stable support and hold on. Lift the other knee in front of you.',
      'Open the knee out to the side and trace a slow circle from the hip.',
      'Keep your pelvis as steady as you can. Reverse direction, then change legs.',
    ],
    ['hips', 'warm up', 'hip rotation'],
  ),
  Front_Leg_Raises: move(
    'Supported Front-to-Back Leg Swings',
    '5–10 controlled swings each leg',
    'Gentle movement through the hip and back of the thigh.',
    'Kicking high or arching your back on the backward swing.',
    'Keep the swing small and the knee slightly bent.',
    [
      'Stand beside a chair or rail and hold it with one hand.',
      'Swing the outside leg forward and back through an easy range.',
      'Keep your torso upright and your standing foot planted. Complete the repetitions, then change legs.',
    ],
    ['hips', 'hamstrings', 'warm up', 'leg swings'],
  ),
  '90_90_Hamstring': move(
    '90/90 Hamstring Extensions',
    '8–10 slow reps each leg',
    'Mild tension behind the thigh as the knee opens.',
    'Locking the knee or turning this into a fast kick.',
    'Keep the thigh a little farther from your chest.',
    [
      'Lie on your back with one leg long. Lift the other thigh so its hip and knee are bent about 90 degrees.',
      'Support the back of that thigh with your hands. Slowly straighten the knee until you feel mild tension.',
      'Bend the knee again without moving the thigh. Repeat and switch legs.',
    ],
    ['hamstrings', 'warm up', 'knee extension'],
  ),
  Wrist_Circles: move(
    'Wrist Circles',
    '5–10 circles each way',
    'Comfortable movement through both wrists.',
    'Clenching the hands or forcing through a pinching sensation.',
    'Rest your forearms on a table with hands just beyond the edge.',
    [
      'Extend your arms out to your sides at a comfortable height and relax your hands.',
      'Keep the arms still while tracing small circles at the wrists.',
      'Slow down through stiff areas and reverse direction.',
    ],
    ['wrists', 'hands', 'forearms', 'desk', 'warm up'],
  ),
  Inchworm: move(
    'Inchworm Walkout',
    '3–5 slow reps',
    'A stretch behind the legs and steady work through the trunk.',
    'Letting the hips sag in the plank or forcing straight knees.',
    'Soften your knees and walk your hands a shorter distance.',
    [
      'Stand with feet close together, fold at your hips, and place your hands on the floor. Soften your knees as needed.',
      'Walk the hands forward a little at a time until you reach a supported plank position.',
      'Keeping your hands planted, take tiny steps with your feet toward your hands. Repeat slowly with room to travel.',
    ],
    ['hamstrings', 'full body', 'warm up'],
  ),
};
