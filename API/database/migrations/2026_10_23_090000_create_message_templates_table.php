<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('topic', 40);
            $table->string('kind', 20);
            $table->string('name');
            $table->text('body');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_system')->default(false);
            $table->timestamps();

            $table->index(['topic', 'kind']);
        });

        $now = now();

        DB::table('message_templates')->insert(array_map(
            fn (array $row) => [...$row, 'user_id' => null, 'is_default' => true, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now],
            [
                // Announcements — compose
                [
                    'topic' => 'misa',
                    'kind' => 'compose',
                    'name' => 'Tangazo la misa',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Unakaribishwa kwenye misa ya Jumapili saa 1:00 asubuhi. Mungu akubariki.',
                ],
                [
                    'topic' => 'mkutano',
                    'kind' => 'compose',
                    'name' => 'Mkutano wa jumuiya',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Kutakuwa na mkutano wa jumuiya siku ya ___ saa ___. Karibu sana.',
                ],
                [
                    'topic' => 'matukio',
                    'kind' => 'compose',
                    'name' => 'Matukio',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Kutakuwa na tukio la ___ siku ya ___ saa ___. Karibu sana.',
                ],
                // Offerings — compose (thank-you for participating)
                [
                    'topic' => 'sadaka',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa sadaka ya ibada',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika sadaka ya ibada. Mungu akubariki.',
                ],
                [
                    'topic' => 'zaka',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa zaka',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika zaka ya parokia. Mungu akubariki.',
                ],
                [
                    'topic' => 'fungu_la_kumi',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa fungu la kumi',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika fungu la kumi. Mungu akubariki.',
                ],
                [
                    'topic' => 'majitoleo',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa majitoleo ya jumuiya',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika majitoleo ya jumuiya. Mungu akubariki.',
                ],
                [
                    'topic' => 'shukrani',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa sadaka ya shukrani',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika sadaka ya shukrani. Mungu akubariki.',
                ],
                [
                    'topic' => 'ujenzi',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa mchango wa ujenzi',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika mchango wa ujenzi. Mungu akubariki.',
                ],
                [
                    'topic' => 'mengineyo',
                    'kind' => 'compose',
                    'name' => 'Shukrani kwa matoleo',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Asante kwa kushiriki katika ___. Mungu akubariki.',
                ],
                // Automatic thank-you SMS when an offering is recorded
                [
                    'topic' => 'sadaka',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Sadaka',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Sadaka yako ya ibada ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
                [
                    'topic' => 'zaka',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Zaka',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Zaka yako ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
                [
                    'topic' => 'fungu_la_kumi',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Fungu la kumi',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Fungu lako la kumi la TSh {kiasi} la tarehe {tarehe} limepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
                [
                    'topic' => 'majitoleo',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Majitoleo',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Majitoleo yako ya jumuiya ya TSh {kiasi} ya tarehe {tarehe} yamepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
                [
                    'topic' => 'shukrani',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Shukrani',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Sadaka yako ya shukrani ya TSh {kiasi} ya tarehe {tarehe} imepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
                [
                    'topic' => 'ujenzi',
                    'kind' => 'thank_you',
                    'name' => 'SMS ya shukrani · Ujenzi',
                    'body' => 'Tumsifu Yesu Kristu {jina}. Mchango wako wa ujenzi wa TSh {kiasi} wa tarehe {tarehe} umepokelewa. Asante kwa kushiriki, Mungu akubariki.',
                ],
            ],
        ));
    }

    public function down(): void
    {
        Schema::dropIfExists('message_templates');
    }
};
